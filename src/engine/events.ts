/**
 * Events: which can fire, how likely, which options are available, and resolving a choice.
 * Pure TypeScript (CLAUDE.md rule 1). Randomness only via the Rng passed in.
 */
import type {
  CrewMember,
  EventCondition,
  EventOption,
  EventType,
  GameEvent,
  Trait,
} from '@/schemas'
import { applyEffect } from './effects'
import { recordChange } from './history'
import {
  activeParts,
  averageMorale,
  bestStat,
  clamp,
  cloneState,
  crewMembers,
  crewName,
  designParts,
  teamModifiers,
} from './missionHelpers'
import type { Rng } from './rng'
import { missionTimeline, type Turn } from './timeline'
import type { Design, EngineContent, MissionContext, MissionState } from './types'

export function conditionMet(c: EventCondition, s: MissionState, ctx: MissionContext): boolean {
  const v = c.value ?? 0
  switch (c.key) {
    case 'powerMarginBelow': {
      const { genW, useW } = s.lastPower
      const margin = genW <= 0 ? (useW > 0 ? -1 : 0) : (genW - useW) / genW
      return margin < v
    }
    case 'noSpares':
      return s.resources.spareKits <= 0
    case 'suitsBelow':
      return s.resources.suits < v
    case 'recyclerInstalled': {
      const parts = activeParts(s, ctx)
      return bestStat(parts, 'waterRecoveryRate') > 0 || bestStat(parts, 'oxygenRecoveryRate') > 0
    }
    case 'dayAfter':
      return s.day > v
    case 'lowMorale':
      return averageMorale(s) < v
    case 'dustLevelAbove':
      return s.dustLevel > v
    case 'leadersAtLeast':
      return crewMembers(ctx).filter((m) => m.traits.includes('leader')).length >= v
  }
}

/** Events that may fire this turn (before the dice roll). */
export function eligibleEvents(s: MissionState, ctx: MissionContext, turn: Turn): GameEvent[] {
  const categories = new Set(designParts(ctx).map((p) => p.category))
  return ctx.content.events.filter((e) => {
    const history = s.eventHistory[e.id]
    return (
      e.destinations.includes(s.destinationId) &&
      (e.location === 'any' || e.location === turn.location) &&
      s.day >= e.trigger.minDay &&
      s.day <= e.trigger.maxDay &&
      (!e.requiresPartCategory || categories.has(e.requiresPartCategory)) &&
      (!history || history.count < e.maxOccurrences) &&
      (!history || turn.turnIndex - history.lastTurn > e.cooldownTurns) &&
      e.trigger.conditions.every((c) => conditionMet(c, s, ctx))
    )
  })
}

/**
 * Per-turn chance. Part-failure events: 1 − Π(1 − failureChancePerTurn) over working parts of
 * that category. Others: base chance, × weaknessChanceMultiplier when the design has that weakness.
 */
export function eventChance(e: GameEvent, s: MissionState, ctx: MissionContext): number {
  if (e.partFailureCategory) {
    const survive = activeParts(s, ctx)
      .filter((p) => p.category === e.partFailureCategory)
      .reduce((acc, p) => acc * (1 - (p.stats.failureChancePerTurn ?? 0)), 1)
    return clamp(1 - survive, 0, 1)
  }
  const boost =
    e.weakness && s.weaknesses.includes(e.weakness)
      ? ctx.content.constants.mission.weaknessChanceMultiplier
      : 1
  // Difficulty scales triggered events, not hardware failure rates.
  const level = ctx.content.constants.difficulty[ctx.design.difficulty]
  return clamp(e.trigger.chance * boost * level.eventChanceMultiplier, 0, 1)
}

/** Rolls every eligible event in content order; at most maxEventsPerTurn fire. */
export function rollEvents(
  s: MissionState,
  ctx: MissionContext,
  turn: Turn,
  rng: Rng,
): GameEvent[] {
  const fired: GameEvent[] = []
  for (const e of eligibleEvents(s, ctx, turn)) {
    if (fired.length >= ctx.content.constants.mission.maxEventsPerTurn) break
    if (rng.chance(eventChance(e, s, ctx))) fired.push(e)
  }
  return fired
}

/** Pacing for this destination (constants.pacing). */
export function pacingFor(ctx: MissionContext, destinationId: string) {
  const p = ctx.content.constants.pacing
  return p.byDestination[destinationId] ?? p.default
}

/** Mission day the most recent event fired on (start of its turn), or null before the first. */
export function lastEventDay(s: MissionState, turns: readonly Turn[]): number | null {
  let last: number | null = null
  for (const h of Object.values(s.eventHistory)) {
    const day = turns[h.lastTurn]?.startDay
    if (day !== undefined && (last === null || day > last)) last = day
  }
  return last
}

/**
 * Pacing on top of the dice: drops rolled events that come too soon after the last one, and when
 * nothing fired forces one (picked with the seeded rng, weighted by each event's chance) if the
 * first event is due or the quiet stretch would pass maxEventGapDays. Deterministic per seed.
 */
export function applyPacing(
  fired: GameEvent[],
  s: MissionState,
  ctx: MissionContext,
  turn: Turn,
  rng: Rng,
): GameEvent[] {
  const pace = pacingFor(ctx, s.destinationId)
  const dest = ctx.content.destinations.find((d) => d.id === s.destinationId)
  if (!dest) return fired
  const last = lastEventDay(s, missionTimeline(dest))
  const since = last === null ? Number.POSITIVE_INFINITY : turn.startDay - last
  if (fired.length > 0) return since < pace.minEventGapDays ? [] : fired
  const due =
    last === null
      ? turn.startDay + turn.days >= pace.firstEventByDay
      : since + turn.days > pace.maxEventGapDays
  if (!due) return []
  const pool = eligibleEvents(s, ctx, turn)
    .map((e) => ({ e, w: eventChance(e, s, ctx) }))
    .filter((x) => x.w > 0)
  const total = pool.reduce((acc, x) => acc + x.w, 0)
  if (total <= 0) return []
  let r = rng.next() * total
  for (const x of pool) {
    r -= x.w
    if (r <= 0) return [x.e]
  }
  return [pool[pool.length - 1]!.e]
}

export const isEvaOption = (o: EventOption): boolean =>
  o.requiresPart === 'suit' || o.tags.includes('eva')

/** Does the option need a crew member to act? */
export const needsCrew = (o: EventOption): boolean =>
  o.skill !== undefined ||
  (o.consumes.crewEnergy ?? 0) > 0 ||
  o.requiresTrait !== undefined ||
  isEvaOption(o)

/** Crew who could take this option right now: alive, not busy, enough energy, right trait. */
export function eligibleCrew(s: MissionState, o: EventOption, ctx: MissionContext): CrewMember[] {
  return crewMembers(ctx).filter((m) => {
    const c = s.crew[m.id]
    return (
      c !== undefined &&
      c.health > 0 &&
      c.busyTurns === 0 &&
      c.energy >= (o.consumes.crewEnergy ?? 0) &&
      (!o.requiresTrait || m.traits.includes(o.requiresTrait))
    )
  })
}

export interface OptionAvailability {
  option: EventOption
  available: boolean
  reason?: string
}

/** Every option with whether it can be chosen now and, if not, a player-facing reason. */
export function availableOptions(
  s: MissionState,
  event: GameEvent,
  design: Design,
  content: EngineContent,
): OptionAvailability[] {
  const ctx = { design, content }
  const parts = activeParts(s, ctx)
  const crewCount = Object.values(s.crew).filter((c) => c.health > 0).length
  const foodPerDay = crewCount * content.constants.perCrewPerDay.foodKg
  return event.options.map((option) => {
    const c = option.consumes
    const req = option.requiresPart
    const reason =
      (c.suits ?? 0) > s.resources.suits || (isEvaOption(option) && s.resources.suits < 1)
        ? 'No suits left'
        : (c.spareKits ?? 0) > s.resources.spareKits
          ? 'No spare kits left'
          : (c.rationDays ?? 0) * foodPerDay > s.resources.foodKg
            ? 'Not enough food to spare'
            : (c.powerWh ?? 0) > s.resources.batteryWh
              ? `Not enough stored power (${Math.round(c.powerWh ?? 0).toLocaleString('en-US')} Wh needed)`
              : req && !parts.some((p) => p.id === req || p.category === req)
                ? `Needs a working ${req.replace(/_/g, ' ').replace(/-/g, ' ')}`
                : needsCrew(option) && eligibleCrew(s, option, ctx).length === 0
                  ? option.requiresTrait
                    ? `No rested ${option.requiresTrait} on the crew`
                    : 'Everyone is too tired or busy'
                  : undefined
    return reason ? { option, available: false, reason } : { option, available: true }
  })
}

/** Trait that suits each event type (+traitBonus). */
const TYPE_AFFINITY: Record<EventType, Trait> = {
  technical: 'practical',
  environmental: 'practical',
  science: 'thinker',
  human: 'leader',
}

/**
 * Success chance = baseSuccess + skill level × skillBonusPerLevel + trait bonus
 * + team repair modifier (technical events) − fatigue penalty, clamped to [minSuccess, maxSuccess].
 * Fatigue penalty = (1 − energy/100) × fatiguePenaltyMax.
 */
export function successChance(
  s: MissionState,
  event: GameEvent,
  option: EventOption,
  crew: CrewMember | null,
  ctx: MissionContext,
): number {
  const M = ctx.content.constants.mission
  let p = option.baseSuccess
  if (crew) {
    if (option.skill) p += crew.skills[option.skill] * M.skillBonusPerLevel
    const trait = option.requiresTrait ?? TYPE_AFFINITY[event.type]
    if (crew.traits.includes(trait)) p += M.traitBonus
    p -= (1 - (s.crew[crew.id]?.energy ?? 0) / 100) * M.fatiguePenaltyMax
  }
  if (event.type === 'technical') p += teamModifiers(ctx).repairSuccess
  // Certain outcomes (baseSuccess 1, no crew) stay certain.
  if (option.baseSuccess >= 1 && !crew) return 1
  return clamp(p, M.minSuccess, M.maxSuccess)
}

export interface ResolveResult {
  applied: boolean
  success: boolean
  chance: number
  explanation: string
  effectsApplied: string[]
}

/**
 * Resolves a choice. Fails cleanly (state unchanged, applied=false) if the option is unavailable
 * or the crew member cannot act. Otherwise consumes resources, rolls, applies effects, logs.
 */
export function resolveEvent(
  state: MissionState,
  event: GameEvent,
  optionId: string,
  crewId: string | null,
  rng: Rng,
  ctx: MissionContext,
  handledBy: 'player' | 'ai' | 'standing-orders' = 'player',
  logPrefix = '',
  /** Repair mini-game hit: added to the success chance, capped at constants.minigame.maxChance. */
  chanceBonus = 0,
): { state: MissionState; result: ResolveResult } {
  const refuse = (explanation: string) => ({
    state,
    result: { applied: false, success: false, chance: 0, explanation, effectsApplied: [] },
  })
  const avail = availableOptions(state, event, ctx.design, ctx.content).find(
    (a) => a.option.id === optionId,
  )
  if (!avail) return refuse(`"${event.title}" has no option "${optionId}".`)
  if (!avail.available) return refuse(`Option unavailable: ${avail.reason}.`)
  const option = avail.option

  let crew: CrewMember | null = null
  if (crewId) {
    crew = eligibleCrew(state, option, ctx).find((m) => m.id === crewId) ?? null
    if (!crew) return refuse(`${crewName(ctx, crewId)} cannot take this on right now.`)
  } else if (needsCrew(option)) {
    return refuse('This option needs a crew member to act.')
  }

  const s = cloneState(state)
  const c = option.consumes
  const crewCount = Object.values(s.crew).filter((m) => m.health > 0).length
  const source = `${event.id}:${option.id}`
  const spend = (key: 'suits' | 'spareKits' | 'foodKg' | 'batteryWh', amount: number) => {
    const before = s.resources[key]
    s.resources[key] = Math.max(0, before - amount)
    recordChange(s, key, s.resources[key] - before, 'option', source, option.label)
  }
  spend('suits', c.suits ?? 0)
  spend('spareKits', c.spareKits ?? 0)
  spend('foodKg', (c.rationDays ?? 0) * crewCount * ctx.content.constants.perCrewPerDay.foodKg)
  spend('batteryWh', c.powerWh ?? 0)
  const crewEnergy = crew ? (s.crew[crew.id]?.energy ?? 0) : null
  if (crew) {
    const cs = s.crew[crew.id]!
    const before = cs.energy
    cs.energy = Math.max(0, cs.energy - (c.crewEnergy ?? 0))
    recordChange(s, `energy:${crew.id}`, cs.energy - before, 'option', source, option.label)
    if ((c.crewEnergy ?? 0) > 0) cs.busyTurns += 1
  }

  const base = successChance(state, event, option, crew, ctx)
  const chance =
    chanceBonus > 0
      ? Math.max(base, Math.min(ctx.content.constants.minigame.maxChance, base + chanceBonus))
      : base
  const success = rng.chance(chance)
  s.decisions.push({
    turn: s.turnIndex,
    day: s.day,
    eventId: event.id,
    optionId: option.id,
    crewId: crew?.id ?? null,
    success,
    chance,
    crewEnergy,
    handledBy,
  })
  const effectsApplied = (success ? option.onSuccess : option.onFail).map((fx) =>
    applyEffect(s, fx, ctx, rng, crew?.id ?? null, event.id),
  )
  const who = crew ? crew.name : 'The crew'
  const explanation = `${who} chose "${option.label}": ${success ? 'success' : 'failed'} (${Math.round(chance * 100)}% chance). ${option.explanation}`
  s.pendingEvents = s.pendingEvents.filter((p) => p.eventId !== event.id)
  s.eventLog.push({
    turnIndex: state.turnIndex,
    day: s.day,
    kind: 'decision',
    text: `${logPrefix}${explanation}`,
    eventId: event.id,
    handledBy,
  })
  return { state: s, result: { applied: true, success, chance, explanation, effectsApplied } }
}
