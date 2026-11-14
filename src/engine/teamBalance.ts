/**
 * Thinker / Practical / Leader balance checks for the recruited team.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import type { CrewMember, Role, Trait } from '@/schemas'

export interface TeamBalanceReport {
  traitCounts: Record<Trait, number>
  missingRoles: Role[]
  /** Warnings in plain language, e.g. "No leader: decisions will take longer." */
  warnings: string[]
  /** 0-1 overall balance score. */
  score: number
}

const notImplemented = (name: string): never => {
  throw new Error(`engine/teamBalance.${name} is not implemented yet`)
}

export function assessTeam(_crew: readonly CrewMember[]): TeamBalanceReport {
  return notImplemented('assessTeam')
}
