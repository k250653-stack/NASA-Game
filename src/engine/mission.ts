/**
 * Mission turn loop. Each turn: power → life support → science/data → crew → events → end checks.
 * Pure TypeScript (CLAUDE.md rule 1): every public function returns a new state; the only
 * mutable input is the Rng, which must come from createRng(seed).
 */
import type { Destination, GameEvent, Part, Weakness } from '@/schemas'
import { computeTotals, marginRatio, resolveDesign } from './budget'
import { chooseResponse, eventOwner } from './crewAI'
import { applyPacing, isEvaOption, resolveEvent, rollEvents } from './events'
import { fmt } from './format'
import { recordChange, recordSnapshot } from './history'
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
      pendingSciencePoints: 0,
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
    hintsEnabled: C.difficulty[design.difficulty].hintsEnabled,
    outcome: null,
    turnHistory: [],
    changes: [],
    decisions: [],
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
      recordChange(
        s,
        'spareKits',
        -1,
        'option',
        'standing-order:repair_eva',
        'EVA repair of the power system',
      )
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
  const before = s.resources.batteryWh
  s.resources.batteryWh = clamp(battery, 0, batteryCapacityWh(s, ctx))
  recordChange(
    s,
    'batteryWh',
    s.resources.batteryWh - before,
    degraded ? 'failure' : 'consumption',
    'power-balance',
    `${fmt(p.genW)} W generated vs ${fmt(p.useW)} W used for ${turn.days} days`,
  )
  s.resources.power = p.genW - p.useW
  s.lastPower = { genW: p.genW, useW: p.useW }
  if (surface) s.dustLevel = 1 - (1 - s.dustLevel) * Math.pow(1 - dest.dustLossPerDay, turn.days)
  const batteryEmpty = s.resources.batteryWh <= 0 && p.genW < p.useW
  return { scienceShed, degraded, batteryEmpty }
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
  let failure: { name: 'oxygen' | 'food' | 'water'; dayLasted: number } | null = null
  const note = `${alive} crew × ${turn.days} days, ${Math.round(recW * 100)}% water / ${Math.round(recO * 100)}% O2 recycled${rationing ? ', rationed' : ''}`
  for (const key of ['oxygenKg', 'foodKg', 'waterKg'] as const) {
    const name = key === 'oxygenKg' ? 'oxygen' : key === 'foodKg' ? 'food' : 'water'
    if (r[key] < want[key]) {
      const dayLasted = (r[key] / want[key]) * turn.days
      if (!failure || dayLasted < failure.dayLasted) failure = { name, dayLasted }
    }
    const before = r[key]
    r[key] = Math.max(0, r[key] - want[key])
    recordChange(s, key, r[key] - before, 'consumption', 'life-support', note)
  }
  if (failure) {
    const phase = dest.phases.find((ph) => ph.id === turn.phaseId)?.name ?? turn.phaseId
    s.day += Math.floor(failure.dayLasted)
    s.outcome = 'failed'
    s.failReason = `${cap(failure.name)} ran out on day ${s.day} during ${phase}.`
    s.failure = { kind: 'supply', resource: failure.name, day: s.day }
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
  const r = s.resources
  // Points travel with their data: they are credited only when the data reaches Earth.
  // Points from parts that make no data are credited at once.
  if (dataGen > 0) r.pendingSciencePoints += points
  const creditedDirect = dataGen > 0 ? 0 : points
  let backlog = r.dataBacklogGb + dataGen
  const sent = Math.min(backlog, capacity)
  const sentShare = backlog > 0 ? sent / backlog : 0
  const credited = r.pendingSciencePoints * sentShare + creditedDirect
  r.pendingSciencePoints *= 1 - sentShare
  backlog -= sent
  let lost = 0
  if (backlog > M.dataStorageGb) {
    lost = backlog - M.dataStorageGb
    const lostPoints = r.pendingSciencePoints * (lost / backlog)
    r.pendingSciencePoints -= lostPoints
    log(
      'warning',
      `Data storage full: ${fmt(lost, 1)} GB of science data lost (${fmt(lostPoints, 1)} points).`,
    )
    recordChange(
      s,
      'dataLostGb',
      lost,
      'failure',
      'data-storage',
      `storage holds ${fmt(M.dataStorageGb)} GB`,
    )
    recordChange(
      s,
      'pendingSciencePoints',
      -lostPoints,
      'failure',
      'data-storage',
      'points lost with the data',
    )
    backlog = M.dataStorageGb
  }
  r.sciencePoints += credited
  r.scienceGb += sent
  const backlogDelta = backlog - r.dataBacklogGb
  r.dataBacklogGb = backlog
  recordChange(
    s,
    'sciencePoints',
    credited,
    'design',
    'instruments',
    `${fmt(sent, 1)} GB reached Earth`,
  )
  recordChange(
    s,
    'scienceGb',
    sent,
    'design',
    'comms',
    `link capacity ${fmt(capacity, 1)} GB this turn`,
  )
  recordChange(
    s,
    'dataBacklogGb',
    backlogDelta,
    'design',
    'instruments',
    `${fmt(dataGen, 1)} GB generated`,
  )
  if (credited > 0 || sent > 0)
    log('science', `+${fmt(credited, 1)} science points returned, ${fmt(sent, 1)} GB sent home.`)
  return { lost }
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
  for (const [id, c] of Object.entries(s.crew)) {
    if (c.health <= 0) continue
    if (c.busyTurns > 0) c.busyTurns -= 1
    else c.energy = clamp(c.energy + M.energyRecoveryPerDay * turn.days, 0, 100)
    c.morale = clamp(c.morale + drift, 0, 100)
    const dh = degraded ? -M.healthLossPerDayNoLifeSupport : M.healthRecoveryPerDay
    const before = c.health
    c.health = clamp(c.health + dh * turn.days, 0, 100)
    if (degraded) {
      recordChange(
        s,
        `health:${id}`,
        c.health - before,
        'failure',
        'power-shortfall',
        'life support degraded',
      )
    }
  }
}

function checkCrewHealth(s: MissionState, ctx: MissionContext): void {
  if (s.outcome) return
  const down = Object.entries(s.crew).find(([, c]) => c.health <= 0)
  if (down) {
    s.outcome = 'failed'
    s.failure = { kind: 'crew-health', crewId: down[0], day: s.day }
    s.failReason = `${crewName(ctx, down[0])}'s health reached 0 on day ${s.day}.`
    s.eventLog.push({ turnIndex: s.turnIndex, day: s.day, kind: 'alarm', text: s.failReason })
  }
}

/** Option tags the standing orders steer (constants: StandingOrdersSchema). */
const ORDER_TAGS = new Set(['eva', 'rest', 'continue', 'shed_science', 'ration'])

/** Does any standing order apply to this event (an EVA, rest, shed-science or ration option)? */
export function standingOrderCovers(event: GameEvent): boolean {
  return event.options.some((o) => isEvaOption(o) || o.tags.some((t) => ORDER_TAGS.has(t)))
}

/**
 * Routes a fired event. Urgent + signal delay too long for a live answer + a standing order that
 * covers it -> the crew answers under standing orders. Otherwise it waits in pendingEvents for
 * the player: their own role as a decision, a teammate's as a proposal to approve or override
 * (settings.playerApprovesAllEvents). With that setting off, teammates answer their own events.
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
  // Standing orders answer only urgent events under signal delay that an order actually covers.
  const byOrders = delayed && event.urgency === 'urgent' && standingOrderCovers(event)
  if ((playerOwns || settings.playerApprovesAllEvents) && !byOrders) {
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
  const prefix = byOrders
    ? `Handled by crew (signal delay ${fmt(delaySec / 60, 1)} min) under standing orders. ${decision.reason} `
    : `${owner.name} (${ROLE_NAMES[event.role]}) handled "${event.title}". ${decision.reason} `
  return resolveEvent(
    state,
    event,
    decision.optionId,
    decision.crewId,
    rng,
    ctx,
    byOrders ? 'standing-orders' : 'ai',
    prefix,
  ).state
}

/**
 * Changes one crew member's morale (a dialogue choice or side-mission reward), clamped to
 * 0-100 and recorded in the change history. Pure: returns a new state.
 */
export function adjustCrewMorale(
  state: MissionState,
  crewId: string,
  delta: number,
  source: string,
): MissionState {
  const c = state.crew[crewId]
  if (!c || delta === 0) return state
  const s = cloneState(state)
  const cs = s.crew[crewId]!
  const before = cs.morale
  cs.morale = clamp(before + delta, 0, 100)
  recordChange(s, `morale:${crewId}`, cs.morale - before, 'event', source, 'a talk with the player')
  return s
}

/**
 * Drops a pending problem nobody can answer (no workable option), with a log line, so the
 * mission can go on. Pure: returns a new state.
 */
export function dropPending(state: MissionState, uid: string, title: string): MissionState {
  const s = cloneState(state)
  const p = s.pendingEvents.find((e) => e.uid === uid)
  s.pendingEvents = s.pendingEvents.filter((e) => e.uid !== uid)
  s.eventLog.push({
    turnIndex: s.turnIndex,
    day: s.day,
    kind: 'warning',
    eventId: p?.eventId,
    text: `Not handled by you: nobody could respond to "${title}".`,
  })
  return s
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
  const flags = (dataLostGb: number) => ({
    dataLostGb,
    batteryEmpty: power.batteryEmpty,
    scienceShed: power.scienceShed,
    lifeSupportDegraded: power.degraded,
    rationing: supply.rationing,
  })
  if (s.outcome) {
    recordSnapshot(s, turn, [], flags(0))
    return { state: s, newEvents: [] }
  }
  const science = stepScience(s, ctx, turn, dest, power.scienceShed, log)
  stepCrew(s, ctx, turn, power.degraded, supply.rationing)
  checkCrewHealth(s, ctx)
  if (s.outcome) {
    recordSnapshot(s, turn, [], flags(science.lost))
    return { state: s, newEvents: [] }
  }

  // Effects and outages that applied this turn tick down before new events add fresh ones.
  s.activeEffects = s.activeEffects
    .map((e) => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
    .filter((e) => e.turnsLeft > 0)
  for (const id of Object.keys(s.disabledParts)) {
    const left = (s.disabledParts[id] ?? 0) - 1
    if (left > 0) s.disabledParts[id] = left
    else delete s.disabledParts[id]
  }

  const fired = applyPacing(rollEvents(s, ctx, turn, rng), s, ctx, turn, rng)
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
  recordSnapshot(
    next,
    turn,
    fired.map((e) => e.id),
    flags(science.lost),
  )
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
