/**
 * Crew recruitment rules: who the player is, which crew can be hired, whether a team is valid,
 * and what it costs. The Recruit screen only displays these results (CLAUDE.md rule 2).
 * Pure TypeScript (CLAUDE.md rule 1).
 */
import { ROLES, type CrewMember, type Difficulty, type Role, type RoleChoice } from '@/schemas'
import { effectiveBudgetM } from './difficulty'
import { ROLE_NAMES } from './missionHelpers'
import { analyzeTeam, type TeamAnalysis } from './teamBalance'
import type { EngineContent } from './types'

/** What the Recruit screen knows about the run so far. */
export interface TeamDraft {
  scenarioId: string
  difficulty: Difficulty
  roleChoice: RoleChoice
  /** Recruited crew, without the player character. */
  crewIds: string[]
}

export interface TeamValidation {
  valid: boolean
  /** Player-facing reasons the team cannot launch yet (empty when valid). */
  reasons: string[]
  /** Slots to fill besides the player. */
  slots: number
  /** Roles the recruits must cover (empty for the Mission Director). */
  requiredRoles: Role[]
  missingRoles: Role[]
  salaryM: number
  budgetM: number
  remainingM: number
}

/** The player's own character for a seat, e.g. player-power-life or player-director. */
export function playerCharacterId(choice: RoleChoice): string {
  return `player-${choice.replace('_', '-')}`
}

/** The crew role the player covers, or null for the Mission Director (covers every role). */
export function playerRoleOf(choice: RoleChoice): Role | null {
  return choice === 'director' ? null : choice
}

/** Recruitable crew (never player characters), in content order. */
export function candidates(content: EngineContent): CrewMember[] {
  return content.crew.filter((m) => !m.isPlayer)
}

function members(ids: readonly string[], content: EngineContent): CrewMember[] {
  return ids
    .map((id) => content.crew.find((m) => m.id === id))
    .filter((m): m is CrewMember => m !== undefined && !m.isPlayer)
}

const listRoles = (roles: readonly Role[]) => roles.map((r) => ROLE_NAMES[r]).join(', ')

/**
 * Rules: crewSize − 1 recruits (the player is the last seat). Unless the player is the Mission
 * Director, the recruits cover every role except the player's, exactly once. Salaries must fit
 * the scenario budget × the difficulty budget multiplier.
 */
export function validateTeam(t: TeamDraft, content: EngineContent): TeamValidation {
  const scenario = content.scenarios.find((s) => s.id === t.scenarioId)
  if (!scenario) throw new Error(`Unknown scenario "${t.scenarioId}"`)
  const team = members(t.crewIds, content)
  const slots = scenario.crewSize - 1
  const playerRole = playerRoleOf(t.roleChoice)
  const requiredRoles = playerRole ? ROLES.filter((r) => r !== playerRole) : []
  const count = (r: Role) => team.filter((m) => m.role === r).length
  const missingRoles = requiredRoles.filter((r) => count(r) === 0)
  const salaryM = team.reduce((acc, m) => acc + m.salaryM, 0)
  const budgetM = effectiveBudgetM(scenario, t.difficulty, content)

  const reasons: string[] = []
  if (team.length < slots)
    reasons.push(
      `Recruit ${slots - team.length} more crew (${team.length} of ${slots} seats filled).`,
    )
  if (team.length > slots) reasons.push(`Only ${slots} seats: remove ${team.length - slots} crew.`)
  const clash = playerRole ? team.find((m) => m.role === playerRole) : undefined
  if (clash)
    reasons.push(`${clash.name} has your role (${ROLE_NAMES[clash.role]}): you already cover it.`)
  const doubled = requiredRoles.filter((r) => count(r) > 1)
  if (doubled.length)
    reasons.push(
      `Each role needs exactly one crew member: ${listRoles(doubled)} has more than one.`,
    )
  if (missingRoles.length && team.length <= slots)
    reasons.push(`Nobody covers ${listRoles(missingRoles)} yet.`)
  if (salaryM > budgetM) reasons.push(`Salaries of $${salaryM}M exceed the $${budgetM}M budget.`)

  return {
    valid: reasons.length === 0,
    reasons,
    slots,
    requiredRoles,
    missingRoles,
    salaryM,
    budgetM,
    remainingM: budgetM - salaryM,
  }
}

/** Live Thinker/Practical/Leader analysis of the recruits (the player has no traits). */
export function teamAnalysis(t: TeamDraft, content: EngineContent): TeamAnalysis {
  return analyzeTeam(members(t.crewIds, content), content.constants.teamRules)
}

export interface RecruitResult {
  crewIds: string[]
  /** Crew member who was swapped out to make room, if any. */
  replacedId?: string
  /** Why the candidate could not be recruited. */
  refused?: string
}

/**
 * Adds a candidate. A candidate with the same role as a current recruit replaces them (one per
 * role); the Mission Director simply fills free seats.
 */
export function recruitCandidate(
  t: TeamDraft,
  candidateId: string,
  content: EngineContent,
): RecruitResult {
  const candidate = candidates(content).find((m) => m.id === candidateId)
  if (!candidate) return { crewIds: t.crewIds, refused: 'Unknown crew member.' }
  if (t.crewIds.includes(candidateId)) return { crewIds: t.crewIds }
  const playerRole = playerRoleOf(t.roleChoice)
  if (playerRole === candidate.role) {
    return { crewIds: t.crewIds, refused: `You already cover ${ROLE_NAMES[candidate.role]}.` }
  }
  const { slots } = validateTeam(t, content)
  if (playerRole) {
    const sameRole = members(t.crewIds, content).find((m) => m.role === candidate.role)
    if (sameRole) {
      return {
        crewIds: t.crewIds.map((id) => (id === sameRole.id ? candidateId : id)),
        replacedId: sameRole.id,
      }
    }
  }
  if (t.crewIds.length >= slots)
    return { crewIds: t.crewIds, refused: `All ${slots} seats are taken: remove someone first.` }
  return { crewIds: [...t.crewIds, candidateId] }
}

/** Longest allowed callsign. */
export const CALLSIGN_MAX_LENGTH = 16

/** Callsign: 1-16 letters, digits, spaces, hyphens or underscores. Empty means "You". */
export function validateCallsign(callsign: string): { ok: boolean; reason?: string } {
  if (callsign.length === 0) return { ok: true }
  if (callsign.length > CALLSIGN_MAX_LENGTH)
    return { ok: false, reason: `Callsign is at most ${CALLSIGN_MAX_LENGTH} characters.` }
  if (!/^[A-Za-z0-9 _-]+$/.test(callsign))
    return { ok: false, reason: 'Use letters, digits, spaces, - or _ only.' }
  if (callsign.trim().length === 0) return { ok: false, reason: 'Callsign cannot be only spaces.' }
  return { ok: true }
}
