/**
 * Rule-based AI teammates. For an event, score every available option × every eligible crew
 * member by expected value under the deciding crew member's priorities (science / safety / cost),
 * apply standing orders, and pick the best. Pure TypeScript, no LLM (CLAUDE.md rule 1).
 */
import type {
  Consumes,
  CrewMember,
  EventEffect,
  EventOption,
  GameEvent,
  Priorities,
  Role,
  StandingOrders,
} from '@/schemas'
import { availableOptions, eligibleCrew, isEvaOption, needsCrew, successChance } from './events'
import { candidates, playerRoleOf, teamAnalysis, validateTeam, type TeamDraft } from './recruitment'
import type { EngineContent, MissionContext, MissionState } from './types'

export interface AiDecision {
  optionId: string
  crewId: string | null
  /** One player-facing sentence. */
  reason: string
  chance: number
}

interface Value {
  science: number
  safety: number
  cost: number
}

const ZERO: Value = { science: 0, safety: 0, cost: 0 }
const add = (a: Value, b: Value): Value => ({
  science: a.science + b.science,
  safety: a.safety + b.safety,
  cost: a.cost + b.cost,
})
const scale = (a: Value, k: number): Value => ({
  science: a.science * k,
  safety: a.safety * k,
  cost: a.cost * k,
})

/** Rough "how much is one unit worth" per resource, and which priority it serves. */
const RESOURCE_VALUE: Record<string, [keyof Value, number]> = {
  batteryWh: ['safety', 1 / 20000],
  waterKg: ['safety', 1 / 50],
  foodKg: ['safety', 1 / 50],
  oxygenKg: ['safety', 1 / 20],
  suits: ['cost', 1],
  spareKits: ['cost', 1],
  scienceGb: ['science', 1 / 20],
  sciencePoints: ['science', 1 / 20],
  dataBacklogGb: ['science', -1 / 50],
}
const MODIFIER_VALUE: Record<string, [keyof Value, number]> = {
  solarOutput: ['safety', 1],
  powerUse: ['safety', -1],
  dataRate: ['science', 1],
  scienceRate: ['science', 1],
  lifeSupportUse: ['safety', -1],
}
const CREW_STAT_VALUE = { health: 2 / 20, energy: 0.5 / 20, morale: 0.5 / 20 }

function effectValue(e: EventEffect, s: MissionState): Value {
  const v = (dim: keyof Value, amount: number): Value => ({ ...ZERO, [dim]: amount })
  const r = RESOURCE_VALUE[e.target]
  if (r) {
    const current = s.resources[e.target as keyof typeof s.resources] ?? 0
    const delta =
      e.op === 'add' ? e.value : e.op === 'multiply' ? current * (e.value - 1) : e.value - current
    return v(r[0], delta * r[1])
  }
  const m = MODIFIER_VALUE[e.target]
  if (m) return v(m[0], (e.value - 1) * m[1] * (e.durationTurns ?? 1))
  if (e.target === 'dustLevel') {
    const delta = e.op === 'add' ? e.value : e.op === 'set' ? e.value - s.dustLevel : 0
    return v('safety', -delta * 10)
  }
  if (e.target.startsWith('part:')) {
    const dim = e.target === 'part:instrument' || e.target === 'part:rover' ? 'science' : 'safety'
    return v(dim, -0.5 * (e.durationTurns ?? 1))
  }
  if (e.op !== 'add' || !e.stat) return ZERO
  const people = e.target === 'allCrew' ? Object.keys(s.crew).length : 1
  return v('safety', e.value * CREW_STAT_VALUE[e.stat] * people)
}

function consumesValue(c: Consumes): Value {
  return {
    science: 0,
    safety: -(c.crewEnergy ?? 0) / 50,
    cost: -(
      (c.suits ?? 0) +
      (c.spareKits ?? 0) +
      (c.rationDays ?? 0) * 0.2 +
      (c.powerWh ?? 0) / 20000
    ),
  }
}

/** Expected value of an option for this success chance, weighted by priorities. */
export function optionScore(
  option: EventOption,
  p: number,
  priorities: Priorities,
  s: MissionState,
): number {
  const sum = (fx: readonly EventEffect[]) =>
    fx.reduce((acc, e) => add(acc, effectValue(e, s)), ZERO)
  const ev = add(
    add(scale(sum(option.onSuccess), p), scale(sum(option.onFail), 1 - p)),
    consumesValue(option.consumes),
  )
  return priorities.science * ev.science + priorities.safety * ev.safety + priorities.cost * ev.cost
}

/** Extra score for options whose tags match a standing order. */
function orderBias(option: EventOption, event: GameEvent, orders: StandingOrders): number {
  const t = option.tags
  let bias = 0
  if (t.includes(orders.crewInjury)) bias += 1
  if (event.role === 'power_life') {
    if (orders.powerEmergency === 'repair_eva' && t.includes('repair')) bias += 0.5
    if (orders.powerEmergency === 'shed_science' && t.includes('shed_science')) bias += 0.5
    if (orders.powerEmergency === 'wait' && t.includes('wait')) bias += 0.5
  }
  if (orders.lowSupplies === 'ration' && t.includes('ration')) bias += 0.5
  return bias
}

/**
 * Picks the option and crew member with the best expected value. Standing orders filter who may
 * act (eva never / only_practical, injured crew rest) and nudge the choice via option tags.
 * Returns null when no option can be taken.
 */
export function chooseResponse(
  state: MissionState,
  event: GameEvent,
  crewPool: readonly CrewMember[],
  priorities: Priorities,
  standingOrders: StandingOrders,
  ctx: MissionContext,
): AiDecision | null {
  const M = ctx.content.constants.mission
  let best: {
    score: number
    option: EventOption
    crew: CrewMember | null
    p: number
    pool: CrewMember[]
  } | null = null

  for (const { option, available } of availableOptions(state, event, ctx.design, ctx.content)) {
    if (!available) continue
    const eva = isEvaOption(option)
    if (eva && standingOrders.eva === 'never') continue
    let pool = eligibleCrew(state, option, ctx).filter((m) => crewPool.some((p) => p.id === m.id))
    if (standingOrders.crewInjury === 'rest') {
      pool = pool.filter((m) => (state.crew[m.id]?.health ?? 0) >= M.injuredHealthBelow)
    }
    if (eva && standingOrders.eva === 'only_practical') {
      pool = pool.filter((m) => m.traits.includes('practical'))
    }
    const candidates: Array<CrewMember | null> = needsCrew(option) ? pool : [null]
    for (const crew of candidates) {
      const p = successChance(state, event, option, crew, ctx)
      const score =
        optionScore(option, p, priorities, state) + orderBias(option, event, standingOrders)
      if (!best || score > best.score + 1e-9) best = { score, option, crew, p, pool }
    }
  }
  if (!best) return null
  return {
    optionId: best.option.id,
    crewId: best.crew?.id ?? null,
    chance: best.p,
    reason: explain(best.option, best.crew, best.p, best.pool, state, priorities),
  }
}

function explain(
  option: EventOption,
  crew: CrewMember | null,
  p: number,
  pool: readonly CrewMember[],
  s: MissionState,
  priorities: Priorities,
): string {
  const pct = `${Math.round(p * 100)}% chance`
  if (!crew) {
    const top = (Object.keys(priorities) as Array<keyof Priorities>).reduce((a, b) =>
      priorities[a] >= priorities[b] ? a : b,
    )
    return `Chose "${option.label}": best expected outcome for ${top} (${pct}).`
  }
  const parts: string[] = []
  if (option.skill) {
    const level = crew.skills[option.skill]
    const isTop = pool.every((m) => m.skills[option.skill!] <= level)
    parts.push(
      `${isTop && pool.length > 1 ? 'highest' : ''} ${option.skill} skill (${level}/5)`.trim(),
    )
  }
  const energy = s.crew[crew.id]?.energy ?? 0
  parts.push(
    energy >= 70 ? 'well rested' : energy < 40 ? 'tired but the best option left' : 'fit to work',
  )
  return `${crew.name} took "${option.label}": ${parts.join(', ')}, ${pct}.`
}

/** The crew member who owns an event: same role, else a leader, else anyone healthy. */
export function eventOwner(
  s: MissionState,
  event: GameEvent,
  crew: readonly CrewMember[],
): CrewMember | null {
  const healthy = crew.filter((m) => (s.crew[m.id]?.health ?? 0) > 0)
  return (
    healthy.find((m) => m.role === event.role) ??
    healthy.find((m) => m.traits.includes('leader')) ??
    healthy[0] ??
    null
  )
}

/** The skill that matters most for each role (used to rank candidates). */
const ROLE_SKILL: Record<Role, keyof CrewMember['skills']> = {
  science: 'science',
  power_life: 'power',
  comms_nav: 'comms',
  launch_budget: 'systems',
}

/** All k-element combinations of a list, in order (deterministic). */
function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]]
  return items.flatMap((item, i) =>
    combinations(items.slice(i + 1), k - 1).map((rest) => [item, ...rest]),
  )
}

/**
 * Suggests a valid, balanced team within budget. Scores every valid team:
 * −100 per team-balance warning, +5 per point of each member's key role skill, −salary ÷ 10
 * (cheaper is better when everything else is equal). Ties keep the first team in content order.
 * Returns null when no valid team exists.
 */
export function suggestTeam(t: TeamDraft, content: EngineContent): string[] | null {
  const pool = candidates(content).filter((m) => m.role !== playerRoleOf(t.roleChoice))
  const { slots } = validateTeam({ ...t, crewIds: [] }, content)
  let best: { ids: string[]; score: number } | null = null
  for (const team of combinations(pool, slots)) {
    const ids = team.map((m) => m.id)
    const draft = { ...t, crewIds: ids }
    if (!validateTeam(draft, content).valid) continue
    const warnings = teamAnalysis(draft, content).warnings.length
    const skill = team.reduce((acc, m) => acc + m.skills[ROLE_SKILL[m.role]], 0)
    const salary = team.reduce((acc, m) => acc + m.salaryM, 0)
    const score = -100 * warnings + 5 * skill - salary / 10
    if (!best || score > best.score + 1e-9) best = { ids, score }
  }
  return best?.ids ?? null
}
