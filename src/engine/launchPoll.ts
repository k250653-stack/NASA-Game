/**
 * Go / No-Go poll: each seat judges the launch checks in its own area, like a flight director
 * polling the room. Fail = no-go, warn = go with concerns, otherwise go. No vetoes: the overall
 * call only follows the checks (any fail blocks launch, warnings need a confirmation).
 * Pure TypeScript (CLAUDE.md rule 1).
 */
import { ROLES, type Role } from '@/schemas'
import { computeTotals, resolveDesign } from './budget'
import { fmt, fmtPct } from './format'
import type { Check, CheckId, Design, EngineContent } from './types'

export type PollVerdict = 'go' | 'go-with-concerns' | 'no-go'
export type OverallCall = 'GO' | 'GO WITH RISKS' | 'NO-GO'

export interface PollLine {
  role: Role
  /** The crew member answering, or null when it is the player's seat (shown as "Your call"). */
  crewId: string | null
  verdict: PollVerdict
  /** One sentence with the numbers from the deciding check. */
  reason: string
  /** Launch checks this seat answers for. */
  checkIds: CheckId[]
}

/** Which launch checks each seat answers for in the poll. */
export const POLL_AREAS: Record<Role, CheckId[]> = {
  launch_budget: ['mass', 'budget', 'crew-count'],
  power_life: ['power', 'battery', 'supplies', 'supply-feasibility', 'suits', 'habitat'],
  comms_nav: ['data'],
  science: [],
}

/** Poll order: like a launch room, money and vehicle first, science last. */
const ORDER: Role[] = ['launch_budget', 'power_life', 'comms_nav', 'science']

/** Expected science over the surface stay: science per surface day × surface days. */
export function expectedScience(design: Design, content: EngineContent): number {
  const { destination } = resolveDesign(design, content)
  const surfaceDays = destination.phases
    .filter((p) => p.location === 'surface')
    .reduce((a, p) => a + p.days, 0)
  return computeTotals(design, content).sciencePerDay * surfaceDays
}

function verdictOf(checks: readonly Check[]): PollVerdict {
  if (checks.some((c) => c.status === 'fail')) return 'no-go'
  if (checks.some((c) => c.status === 'warn')) return 'go-with-concerns'
  return 'go'
}

function sciencePoll(
  design: Design,
  content: EngineContent,
): { verdict: PollVerdict; reason: string } {
  const { scenario } = resolveDesign(design, content)
  const expected = expectedScience(design, content)
  const share = expected / scenario.scienceTarget
  const ok = share >= content.constants.launch.scienceConcernBelow
  return {
    verdict: ok ? 'go' : 'go-with-concerns',
    reason: `Our instruments should return about ${fmt(expected)} science points against a target of ${fmt(scenario.scienceTarget)} (${fmtPct(share)}).`,
  }
}

function launchBudgetExtra(
  design: Design,
  content: EngineContent,
): { concern: boolean; reason: string } | null {
  const { rocket } = resolveDesign(design, content)
  if (!rocket) return null
  const limit = content.constants.launch.reliabilityConcernBelow
  return {
    concern: rocket.reliability < limit,
    reason: `The ${rocket.name} is ${fmtPct(rocket.reliability)} reliable${rocket.reliability < limit ? `, below the ${fmtPct(limit)} we like to fly` : ''}.`,
  }
}

/**
 * One line per seat. Science judges expected output against the target; Launch & Budget adds
 * rocket reliability; everyone else judges the checks in POLL_AREAS.
 */
export function goNoGoPoll(
  checks: readonly Check[],
  design: Design,
  content: EngineContent,
): PollLine[] {
  const crew = design.crewIds
    .map((id) => content.crew.find((m) => m.id === id))
    .filter((m) => m && !m.isPlayer)
  return ORDER.filter((r) => ROLES.includes(r)).map((role) => {
    const isPlayer = design.playerRole === null || design.playerRole === role
    const crewId = isPlayer ? null : (crew.find((m) => m?.role === role)?.id ?? null)
    const mine = checks.filter((c) => POLL_AREAS[role].includes(c.id))
    if (role === 'science') {
      const s = sciencePoll(design, content)
      return { role, crewId, verdict: s.verdict, reason: s.reason, checkIds: [] }
    }
    let verdict = verdictOf(mine)
    const deciding = mine.find((c) => c.status === 'fail') ?? mine.find((c) => c.status === 'warn')
    let reason =
      deciding?.explanation ??
      (mine[0] ? `All green. ${mine[0].explanation}` : 'Nothing in my area.')
    if (role === 'launch_budget') {
      const extra = launchBudgetExtra(design, content)
      if (extra?.concern && verdict === 'go') {
        verdict = 'go-with-concerns'
        reason = extra.reason
      } else if (extra && verdict === 'go') {
        reason = `${reason} ${extra.reason}`
      }
    }
    return { role, crewId, verdict, reason, checkIds: POLL_AREAS[role] }
  })
}

/**
 * Any failing check -> NO-GO. Any warning, or any seat with concerns (e.g. science below target,
 * a shaky rocket) -> GO WITH RISKS. Otherwise GO.
 */
export function overallCall(checks: readonly Check[], poll: readonly PollLine[] = []): OverallCall {
  if (checks.some((c) => c.status === 'fail')) return 'NO-GO'
  if (checks.some((c) => c.status === 'warn') || poll.some((l) => l.verdict !== 'go'))
    return 'GO WITH RISKS'
  return 'GO'
}
