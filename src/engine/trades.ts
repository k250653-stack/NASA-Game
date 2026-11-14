/**
 * Negotiation: how an AI teammate judges a trade. Deterministic: same inputs, same verdict.
 *
 * In plain words:
 * 1. Hard rules first. A teammate refuses if the trade touches things the parties don't own,
 *    takes away the last part their job depends on (the only instrument, the only antenna...),
 *    or breaks a launch check in their own area. The Launch & Budget teammate vetoes trades
 *    that push the team over budget.
 * 2. Otherwise they weigh it with their own priorities: change in science per day (science),
 *    in safety (failing/warning checks, power margin, days of supplies), and in cost (money and
 *    mass saved). Fixing an over-limit rocket or budget counts for a lot, and counts even more
 *    when the team is already over the limit.
 * 3. A positive total is accepted. A mildly negative one gets a counter-offer (a gentler version
 *    of what was asked). A clearly negative one is refused.
 */
import type { CrewMember, Part, PartCategory, Role } from '@/schemas'
import { computeTotals, resolveDesign, rocketCapacityKg } from './budget'
import { effectiveBudgetM } from './difficulty'
import { fmt } from './format'
import { runLaunchCheck } from './launchCheck'
import { ROLE_NAMES } from './missionHelpers'
import { applyChanges, ownerOfChange, type DesignChange } from './planning'
import type { CheckId, Design, EngineContent } from './types'

export interface Trade {
  /** The proposer's seat. */
  from: Role
  /** The teammate who must agree. */
  to: Role
  /** Changes to the proposer's own items. */
  give: DesignChange[]
  /** Changes to the teammate's items. */
  ask: DesignChange[]
}

export type Verdict = 'accept' | 'counter' | 'refuse'

export interface TradeResult {
  verdict: Verdict
  counter?: Trade
  /** One player-facing sentence with numbers. */
  reason: string
  /** "accept:1" etc. — index into the teammate's dialogue lines for that verdict. */
  dialogueKey: string
  /** Weighted score the verdict came from (positive = good for this teammate). */
  score: number
}

/** The part category a role cannot work without. */
const CORE: Partial<Record<Role, PartCategory[]>> = {
  science: ['instrument'],
  power_life: ['life_support', 'habitat', 'power'],
  comms_nav: ['comms'],
}
/** Launch checks each role answers for. */
const DOMAIN: Record<Role, CheckId[]> = {
  science: [],
  power_life: ['power', 'battery', 'supplies', 'supply-feasibility', 'suits', 'habitat'],
  comms_nav: ['data'],
  launch_budget: ['budget', 'mass'],
}
/** Score above which a trade is accepted, and below which it is refused outright. */
const ACCEPT_AT = 0
const COUNTER_FLOOR = -1

interface Metrics {
  massKg: number
  massOverKg: number
  costM: number
  budgetOverM: number
  sciencePerDay: number
  powerMargin: number
  fails: Set<CheckId>
  warns: number
  capacity: number
  budget: number
}

function metrics(design: Design, content: EngineContent): Metrics {
  const t = computeTotals(design, content)
  const { rocket, destination, scenario } = resolveDesign(design, content)
  const capacity = rocketCapacityKg(rocket, destination)
  const budget = effectiveBudgetM(scenario, design.difficulty, content)
  const checks = runLaunchCheck(design, content)
  return {
    massKg: t.massKg,
    massOverKg: Math.max(0, t.massKg - capacity),
    costM: t.costM,
    budgetOverM: Math.max(0, t.costM - budget),
    sciencePerDay: t.sciencePerDay,
    powerMargin: t.powerGenW > 0 ? (t.powerGenW - t.powerUseW) / t.powerGenW : -1,
    fails: new Set(checks.filter((c) => c.status === 'fail').map((c) => c.id)),
    warns: checks.filter((c) => c.status === 'warn').length,
    capacity,
    budget,
  }
}

const partOf = (id: string, content: EngineContent): Part | undefined =>
  content.parts.find((p) => p.id === id)

/** Small stable hash so the same trade always picks the same dialogue line. */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0
  return h
}

function dialogueKey(verdict: Verdict, trade: Trade, teammate: CrewMember): string {
  const lines = teammate.dialogue?.[verdict] ?? []
  return `${verdict}:${lines.length ? hash(JSON.stringify(trade)) % lines.length : 0}`
}

/** Weighted value of moving from `a` to `b` for someone with these priorities. */
function value(
  a: Metrics,
  b: Metrics,
  teammate: CrewMember,
): { score: number; parts: Record<string, number> } {
  const p = teammate.priorities
  const overBefore = a.massOverKg > 0 || a.budgetOverM > 0
  const fix =
    ((a.massOverKg - b.massOverKg) / Math.max(1, a.capacity)) * 20 +
    ((a.budgetOverM - b.budgetOverM) / Math.max(1, a.budget)) * 20
  const team = fix * (overBefore ? 1.5 : 0.5)
  const science = (b.sciencePerDay - a.sciencePerDay) / Math.max(1, a.sciencePerDay)
  const newFails = [...b.fails].filter(
    (f) => !a.fails.has(f) && f !== 'mass' && f !== 'budget',
  ).length
  const fixedFails = [...a.fails].filter(
    (f) => !b.fails.has(f) && f !== 'mass' && f !== 'budget',
  ).length
  const safety =
    fixedFails -
    newFails -
    0.3 * (b.warns - a.warns) +
    Math.max(-1, Math.min(1, (b.powerMargin - a.powerMargin) * 2))
  const cost =
    ((a.costM - b.costM) / Math.max(1, a.budget)) * 5 +
    ((a.massKg - b.massKg) / Math.max(1, a.capacity)) * 2
  const score = team + p.science * science * 3 + p.safety * safety + p.cost * cost
  return { score, parts: { team, science, safety, cost } }
}

/** A gentler version of an ask: remove -> swap to the lightest alternative; supply -> half. */
function soften(change: DesignChange, content: EngineContent): DesignChange | null {
  if (change.kind === 'supply')
    return Math.abs(change.deltaKg) >= 2
      ? { ...change, deltaKg: Math.round(change.deltaKg / 2) }
      : null
  if (change.kind === 'removePart') {
    const part = partOf(change.partId, content)
    const lighter = content.parts
      .filter(
        (p) => p.category === part?.category && p.id !== part?.id && p.massKg < (part?.massKg ?? 0),
      )
      .sort((x, y) => x.massKg - y.massKg)[0]
    return lighter && part ? { kind: 'swapPart', fromId: part.id, toId: lighter.id } : null
  }
  if (change.kind === 'swapPart') {
    const from = partOf(change.fromId, content)
    const to = partOf(change.toId, content)
    if (!from || !to) return null
    const middle = content.parts
      .filter((p) => p.category === from.category && p.massKg < from.massKg && p.massKg > to.massKg)
      .sort((x, y) => y.massKg - x.massKg)[0]
    return middle ? { kind: 'swapPart', fromId: from.id, toId: middle.id } : null
  }
  return null
}

function describe(a: Metrics, b: Metrics): string {
  const bits: string[] = []
  if (Math.round(b.massKg) !== Math.round(a.massKg))
    bits.push(`mass ${fmt(a.massKg)} → ${fmt(b.massKg)} kg (limit ${fmt(a.capacity)})`)
  if (Math.abs(b.costM - a.costM) >= 0.05)
    bits.push(`cost $${fmt(a.costM, 1)}M → $${fmt(b.costM, 1)}M`)
  if (b.sciencePerDay !== a.sciencePerDay)
    bits.push(`science ${fmt(a.sciencePerDay)} → ${fmt(b.sciencePerDay)} pts/day`)
  return bits.join(', ') || 'no change to mass, cost or science'
}

export function evaluateTrade(
  trade: Trade,
  teammate: CrewMember,
  design: Design,
  content: EngineContent,
): TradeResult {
  const result = (
    verdict: Verdict,
    reason: string,
    score: number,
    counter?: Trade,
  ): TradeResult => ({
    verdict,
    reason,
    score,
    dialogueKey: dialogueKey(verdict, trade, teammate),
    ...(counter ? { counter } : {}),
  })

  // 1. Hard rules.
  const wrongGive = trade.give.find((c) => ownerOfChange(c, content) !== trade.from)
  const wrongAsk = trade.ask.find((c) => ownerOfChange(c, content) !== trade.to)
  if (wrongGive || wrongAsk)
    return result('refuse', 'That trade includes things neither of us controls.', -Infinity)
  if (trade.ask.length === 0 && trade.give.length === 0)
    return result('refuse', 'There is nothing in that trade.', -Infinity)

  const after = applyChanges(design, [...trade.give, ...trade.ask])
  for (const cat of CORE[teammate.role] ?? []) {
    const had = design.partIds.filter((id) => partOf(id, content)?.category === cat).length
    const left = after.partIds.filter((id) => partOf(id, content)?.category === cat).length
    if (had > 0 && left === 0) {
      return result(
        'refuse',
        `That would leave us with no ${cat.replace('_', ' ')} at all — my job depends on it.`,
        -Infinity,
      )
    }
  }
  const a = metrics(design, content)
  const b = metrics(after, content)
  // The budget veto is a team rule, so it comes before the teammate's own systems.
  const vetoer = design.crewIds
    .map((id) => content.crew.find((m) => m.id === id))
    .find((m) => m && !m.isPlayer && content.roles.find((r) => r.id === m.role)?.owns.budgetVeto)
  if (b.budgetOverM > a.budgetOverM + 0.05 && vetoer) {
    return result(
      'refuse',
      `${vetoer.name} (${ROLE_NAMES[vetoer.role]}) vetoes it: cost would go from $${fmt(a.costM, 1)}M to $${fmt(b.costM, 1)}M, over the $${fmt(a.budget)}M budget.`,
      -Infinity,
    )
  }

  const broken = DOMAIN[teammate.role].filter(
    (id) => b.fails.has(id) && !a.fails.has(id) && id !== 'mass' && id !== 'budget',
  )
  if (broken.length) {
    const check = runLaunchCheck(after, content).find((c) => c.id === broken[0])
    return result(
      'refuse',
      `No: ${check?.explanation ?? 'it breaks one of my systems.'}`,
      -Infinity,
    )
  }
  // 2. Weigh it.
  const { score } = value(a, b, teammate)
  const fixesLimit =
    (a.massOverKg > 0 && b.massOverKg < a.massOverKg) ||
    (a.budgetOverM > 0 && b.budgetOverM < a.budgetOverM)
  if (score >= ACCEPT_AT) {
    const why = fixesLimit
      ? b.massOverKg === 0 && a.massOverKg > 0
        ? `it gets us under the rocket limit: ${describe(a, b)}.`
        : `it moves us toward our limits: ${describe(a, b)}.`
      : `it works for my priorities: ${describe(a, b)}.`
    return result('accept', `Deal — ${why}`, score)
  }

  // 3. Counter or refuse.
  if (score >= COUNTER_FLOOR) {
    const softened = trade.ask.map((c) => soften(c, content))
    if (softened.every((c): c is DesignChange => c !== null)) {
      const counter: Trade = { ...trade, ask: softened }
      const c = metrics(applyChanges(design, [...counter.give, ...counter.ask]), content)
      if (value(a, c, teammate).score >= ACCEPT_AT) {
        return result(
          'counter',
          `Too much as asked (${describe(a, b)}). I can do a smaller version: ${describe(a, c)}.`,
          score,
          counter,
        )
      }
    }
  }
  return result('refuse', `It costs me more than it gives the team: ${describe(a, b)}.`, score)
}
