/**
 * Mission turn loop. Each turn: power → life support → science/data → crew → events → end checks.
 * Pure TypeScript (CLAUDE.md rule 1): every public function returns a new state; the only
 * mutable input is the Rng, which must come from createRng(seed).
 */
import type { Destination, GameEvent, Part, Weakness } from '@/schemas'
import { computeTotals, marginRatio, resolveDesign } from './budget'
import { chooseResponse, eventOwner } from './crewAI'
import { resolveEvent, rollEvents } from './events'
import { fmt } from './format'
import {
  activeParts,
  averageMorale,
  batteryCapacityWh,
  bestStat,
  clamp,
  cloneState,
  crewMembers,
  crewName,
  modifier,
  ROLE_NAMES,
  sumStat,
  teamModifiers,
} from './missionHelpers'
import { daysOfSupply, dataReturnedGbPerDay, lifeSupportNeedKg } from './physics'
import type { Rng } from './rng'
import { missionTimeline, signalDelay, totalMissionDays, type Turn } from './timeline'
import type { Design, EngineContent, LogKind, MissionContext, MissionState } from './types'

export type { MissionState, LogEntry as MissionLogEntry } from './types'

const isSciencePart = (p: Part) => p.category === 'instrument' || p.category === 'rover'
const worksAt = (p: Part, turn: Turn) => p.location === 'any' || turn.location === 'surface'

function destinationOf(ctx: MissionContext): Destination {
  return resolveDesign(ctx.design, ctx.content).destination
}

/** Fresh state on launch day: supplies as packed, batteries full, crew rested. */
export function initMission(design: Design, content: EngineContent, seed: number): MissionState {
  const ctx = { design, content }
  const destination = destinationOf(ctx)
  const t = computeTotals(design, content)
  const C = content.constants
  const turns = missionTimeline(destination)
  const first = turns[0]!

  const weaknesses: Weakness[] = []
  if (marginRatio(t.powerGenW, t.powerUseW) < C.powerMarginTarget.value) weaknesses.push('power')
  if (t.waterRecoveryRate === 0 && t.oxygenRecoveryRate === 0) weaknesses.push('life_support')
  if (
    t.dataGenGbPerDay > 0 &&
    t.dataReturnGbPerDay / t.dataGenGbPerDay < C.dataReturnWarnRatio.value
  )
    weaknesses.push('comms')
  if (t.suitCount < 2) weaknesses.push('eva')

  return {
    seed,
    destinationId: destination.id,
    turnIndex: 0,
    totalTurns: turns.length,
    day: 0,
    phaseId: first.phaseId,
    location: first.location,
    resources: {
      power: 0,
      batteryWh: t.batteryWh,
      waterKg: design.supplies.waterKg,
      foodKg: design.supplies.foodKg,
      oxygenKg: design.supplies.oxygenKg,
      suits: t.suitCount,
      spareKits: t.spareKits,
      scienceGb: 0,
      sciencePoints: 0,
      dataBacklogGb: 0,
    },
    crew: Object.fromEntries(
      design.crewIds.map((id) => [
        id,
        { energy: 100, morale: C.mission.startMorale, health: 100, busyTurns: 0 },
      ]),
    ),
    disabledParts: {},
    activeEffects: [],
    eventLog: [
      {
        turnIndex: 0,
        day: 0,
        kind: 'info',
        text: `Launch! ${destination.name}, ${turns.length} turns planned.`,
      },
    ],
    pendingEvents: [],
    eventHistory: {},
    dustLevel: 0,
    weaknesses,
    lastPower: { genW: t.powerGenW, useW: t.powerUseW },
    abortedEarly: false,
    outcome: null,
  }
}

export function isMissionOver(s: MissionState): boolean {
  return s.outcome !== null || s.turnIndex >= s.totalTurns
}

type Log = (kind: LogKind, text: string) => void

/** 2. Power: generation vs use over the turn; battery absorbs the difference. */
function stepPower(s: MissionState, ctx: MissionContext, turn: Turn, dest: Destination, log: Log) {
  const M = ctx.content.constants.mission
  const surface = turn.location === 'surface'
  const compute = () => {
    const parts = activeParts(s, ctx).filter((p) => worksAt(p, turn))
    const sunlight = surface ? dest.sunlightFactor : (1 + dest.sunlightFactor) / 2
    const light = surface ? dest.lightFraction : M.transitLightFraction
    const solarW =
      sumStat(parts, 'ratedPowerW') *
      sunlight *
      light *
      (1 - s.dustLevel) *
      modifier(s, 'solarOutput')
    const steadyW = parts.reduce((acc, p) => acc + Math.max(0, p.powerW), 0)
    const draw = (list: Part[]) =>
      list.reduce((acc, p) => acc + Math.max(0, -p.powerW), 0) * modifier(s, 'powerUse')
    return {
      genW: solarW + steadyW,
      useW: draw(parts),
      scienceW: draw(parts.filter(isSciencePart)),
    }
  }
  const hours = 24 * turn.days
  let p = compute()
  let battery = s.resources.batteryWh + (p.genW - p.useW) * hours
  let scienceShed = false
  let degraded = false
  const order = ctx.design.standingOrders.powerEmergency

  if (battery < 0 && order === 'repair_eva') {
    const broken = Object.keys(s.disabledParts).filter((id) => {
      const cat = ctx.content.parts.find((x) => x.id === id)?.category
      return cat === 'power' || cat === 'battery'
    })
    if (broken.length > 0 && s.resources.spareKits >= 1 && s.resources.suits >= 1) {
      broken.forEach((id) => delete s.disabledParts[id])
      s.resources.spareKits -= 1
      log(
        'decision',
        'Battery running flat: crew went on an EVA and repaired the power system (standing order).',
      )
      p = compute()
      battery = s.resources.batteryWh + (p.genW - p.useW) * hours
    }
  }
  if (battery < 0 && order !== 'wait' && p.scienceW > 0) {
    battery += p.scienceW * hours
    scienceShed = true
    log(
      'warning',
      `Battery running flat: ${fmt(p.scienceW)} W of science instruments switched off to protect life support.`,
    )
  }
  if (battery < 0) {
    battery = 0
    degraded = true
    log('alarm', 'Power shortfall: life support is running degraded and crew health is falling.')
  }
  s.resources.batteryWh = clamp(battery, 0, batteryCapacityWh(s, ctx))
  s.resources.power = p.genW - p.useW
  s.lastPower = { genW: p.genW, useW: p.useW }
  if (surface) s.dustLevel = 1 - (1 - s.dustLevel) * Math.pow(1 - dest.dustLossPerDay, turn.days)
  return { scienceShed, degraded }
}

/** 1. Life support: consume O2/food/water with recycling; ration or abort when short. */
function stepLifeSupport(
  s: MissionState,
  ctx: MissionContext,
  turn: Turn,
  dest: Destination,
  degraded: boolean,
  log: Log,
) {
  const C = ctx.content.constants
  const parts = activeParts(s, ctx)
  const recW = degraded ? 0 : bestStat(parts, 'waterRecoveryRate')
  const recO = degraded ? 0 : bestStat(parts, 'oxygenRecoveryRate')
  const alive = Object.values(s.crew).filter((c) => c.health > 0).length
  const r = s.resources
  const remaining = totalMissionDays(dest) - s.day
  const lasts = daysOfSupply(
    { oxygenKg: r.oxygenKg, foodKg: r.foodKg, waterKg: r.waterKg },
    alive,
    C.perCrewPerDay,
    recW,
    recO,
  )
  let rationing = false
  let abort = false
  if (lasts.days < remaining) {
    if (
      ctx.design.standingOrders.lowSupplies === 'abort_early' &&
      turn.location === 'surface' &&
      !s.abortedEarly
    ) {
      abort = true
      s.abortedEarly = true
      log(
        'warning',
        `${cap(lasts.limiting)} will last ${fmt(lasts.days, 1)} of the remaining ${fmt(remaining)} days: the crew is cutting the surface stay short (standing order).`,
      )
    } else {
      rationing = true
      log(
        'warning',
        `Rationing food: ${lasts.limiting} lasts ${fmt(lasts.days, 1)} days but ${fmt(remaining)} remain.`,
      )
    }
  }
  const need = lifeSupportNeedKg(alive, turn.days, C.perCrewPerDay, recW, recO)
  const mult = modifier(s, 'lifeSupportUse')
  const want = {
    oxygenKg: need.oxygen * mult,
    foodKg: need.food * mult * (rationing ? C.mission.rationFoodFactor : 1),
    waterKg: need.water * mult,
  }
  let failure: { name: string; dayLasted: number } | null = null
  for (const key of ['oxygenKg', 'foodKg', 'waterKg'] as const) {
    if (r[key] < want[key]) {
      const dayLasted = (r[key] / want[key]) * turn.days
      if (!failure || dayLasted < failure.dayLasted)
        failure = { name: key.replace('Kg', ''), dayLasted }
    }
    r[key] = Math.max(0, r[key] - want[key])
  }
  if (failure) {
    const phase = dest.phases.find((ph) => ph.id === turn.phaseId)?.name ?? turn.phaseId
    s.day += Math.floor(failure.dayLasted)
    s.outcome = 'failed'
    s.failReason = `${cap(failure.name)} ran out on day ${s.day} during ${phase}.`
    log('alarm', s.failReason)
  }
  return { rationing, abort }
}

/** 3. Science (surface parts only on the surface), downlink, backlog and overflow. */
function stepScience(
  s: MissionState,
  ctx: MissionContext,
  turn: Turn,
  dest: Destination,
  shed: boolean,
  log: Log,
) {
  const M = ctx.content.constants.mission
  const parts = activeParts(s, ctx).filter((p) => worksAt(p, turn))
  const producing = shed ? parts.filter((p) => !isSciencePart(p)) : parts
  const rate = modifier(s, 'scienceRate')
  let points = sumStat(producing, 'sciencePointsPerDay') * turn.days * rate
  if (averageMorale(s) < M.lowMoraleThreshold) points *= M.lowMoraleScienceFactor
  const dataGen = sumStat(producing, 'scienceDataGbPerDay') * turn.days * rate
  const hours =
    turn.location === 'surface' ? dest.contactHoursPerDay : dest.transitContactHoursPerDay
  const capacity =
    dataReturnedGbPerDay(sumStat(parts, 'dataRateMbps'), hours) *
    turn.days *
    modifier(s, 'dataRate')
  let backlog = s.resources.dataBacklogGb + dataGen
  const sent = Math.min(backlog, capacity)
  backlog -= sent
  if (backlog > M.dataStorageGb) {
    log(
      'warning',
      `Data storage full: ${fmt(backlog - M.dataStorageGb, 1)} GB of science data lost.`,
    )
    backlog = M.dataStorageGb
  }
  s.resources.sciencePoints += points
  s.resources.scienceGb += sent
  s.resources.dataBacklogGb = backlog
  if (points > 0 || sent > 0)
    log('science', `+${fmt(points, 1)} science points, ${fmt(sent, 1)} GB sent home.`)
}

/** 4. Crew: energy recovers when not busy, morale drifts, health falls without life support. */
function stepCrew(
  s: MissionState,
  ctx: MissionContext,
  turn: Turn,
  degraded: boolean,
  rationing: boolean,
) {
  const M = ctx.content.constants.mission
  const drift = teamModifiers(ctx).moraleDrift + (rationing ? M.rationMoralePerTurn : 0)
  for (const c of Object.values(s.crew)) {
    if (c.health <= 0) continue
    if (c.busyTurns > 0) c.busyTurns -= 1
    else c.energy = clamp(c.energy + M.energyRecoveryPerDay * turn.days, 0, 100)
    c.morale = clamp(c.morale + drift, 0, 100)
    const dh = degraded ? -M.healthLossPerDayNoLifeSupport : M.healthRecoveryPerDay
    c.health = clamp(c.health + dh * turn.days, 0, 100)
  }
}

function checkCrewHealth(s: MissionState, ctx: MissionContext): void {
  if (s.outcome) return
  const down = Object.entries(s.crew).find(([, c]) => c.health <= 0)
  if (down) {
    s.outcome = 'failed'
    s.failReason = `${crewName(ctx, down[0])}'s health reached 0 on day ${s.day}.`
    s.eventLog.push({ turnIndex: s.turnIndex, day: s.day, kind: 'alarm', text: s.failReason })
  }
}

/**
 * Routes a fired event. Not the player's role -> the AI owner of that role answers.
 * Player's role but urgent and the signal delay is too long for a live answer -> the crew
 * answers under standing orders. Otherwise it waits in pendingEvents for the player.
 */
export function dispatchEvent(
  state: MissionState,
  event: GameEvent,
  ctx: MissionContext,
  rng: Rng,
): MissionState {
  const dest = destinationOf(ctx)
  const settings = ctx.content.constants.settings
  const playerOwns = ctx.design.playerRole === null || ctx.design.playerRole === event.role
  const delaySec = signalDelay(dest, state.day)
  const delayed =
    !settings.liveResponseDestinations.includes(dest.id) && delaySec > settings.delayThresholdSec
  if (playerOwns && !(delayed && event.urgency === 'urgent')) {
    const s = cloneState(state)
    s.pendingEvents.push({
      uid: `${event.id}@${state.turnIndex}`,
      eventId: event.id,
      turnIndex: state.turnIndex,
      day: state.day,
    })
    return s
  }
  const crew = crewMembers(ctx)
  const owner = eventOwner(state, event, crew)
  const decision = owner
    ? chooseResponse(state, event, crew, owner.priorities, ctx.design.standingOrders, ctx)
    : null
  if (!owner || !decision) {
    const s = cloneState(state)
    s.eventLog.push({
      turnIndex: s.turnIndex,
      day: s.day,
      kind: 'warning',
      eventId: event.id,
      text: `Nobody could respond to "${event.title}": no option was workable.`,
    })
    return s
  }
  const prefix = playerOwns
    ? `Handled by crew (signal delay ${fmt(delaySec / 60, 1)} min) under standing orders. ${decision.reason} `
    : `${owner.name} (${ROLE_NAMES[event.role]}) handled "${event.title}". ${decision.reason} `
  return resolveEvent(
    state,
    event,
    decision.optionId,
    decision.crewId,
    rng,
    ctx,
    playerOwns ? 'standing-orders' : 'ai',
    prefix,
  ).state
}

/** Simulates one turn. Returns the new state and the events that fired this turn. */
export function advanceTurn(
  state: MissionState,
  design: Design,
  content: EngineContent,
  rng: Rng,
): { state: MissionState; newEvents: GameEvent[] } {
  if (isMissionOver(state)) return { state, newEvents: [] }
  const ctx = { design, content }
  const dest = destinationOf(ctx)
  const turns = missionTimeline(dest)
  const turn = turns[state.turnIndex]!
  const s = cloneState(state)
  const log: Log = (kind, text) =>
    s.eventLog.push({ turnIndex: turn.turnIndex, day: s.day, kind, text })

  const power = stepPower(s, ctx, turn, dest, log)
  const supply = stepLifeSupport(s, ctx, turn, dest, power.degraded, log)
  if (s.outcome) return { state: s, newEvents: [] }
  stepScience(s, ctx, turn, dest, power.scienceShed, log)
  stepCrew(s, ctx, turn, power.degraded, supply.rationing)
  checkCrewHealth(s, ctx)
  if (s.outcome) return { state: s, newEvents: [] }

  // Effects and outages that applied this turn tick down before new events add fresh ones.
  s.activeEffects = s.activeEffects
    .map((e) => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
    .filter((e) => e.turnsLeft > 0)
  for (const id of Object.keys(s.disabledParts)) {
    const left = (s.disabledParts[id] ?? 0) - 1
    if (left > 0) s.disabledParts[id] = left
    else delete s.disabledParts[id]
  }

  const fired = rollEvents(s, ctx, turn, rng)
  let next = s
  for (const e of fired) {
    next.eventHistory[e.id] = {
      count: (next.eventHistory[e.id]?.count ?? 0) + 1,
      lastTurn: turn.turnIndex,
    }
    next.eventLog.push({
      turnIndex: turn.turnIndex,
      day: next.day,
      kind: 'event',
      eventId: e.id,
      text: `${e.title}: ${e.description}`,
    })
    next = dispatchEvent(next, e, ctx, rng)
  }
  checkCrewHealth(next, ctx)
  if (next.outcome) return { state: next, newEvents: fired }

  next.day += turn.days
  const after = supply.abort
    ? turns.findIndex((t) => t.turnIndex > turn.turnIndex && t.location !== 'surface')
    : -1
  next.turnIndex = after >= 0 ? after : turn.turnIndex + 1
  const upcoming = turns[next.turnIndex]
  if (upcoming) {
    next.phaseId = upcoming.phaseId
    next.location = upcoming.location
  } else {
    next.eventLog.push({
      turnIndex: turn.turnIndex,
      day: next.day,
      kind: 'info',
      text: `Mission complete after ${next.day} days. Outcome is decided at the debrief.`,
    })
  }
  return { state: next, newEvents: fired }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
