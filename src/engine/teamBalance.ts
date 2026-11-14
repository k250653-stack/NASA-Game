/**
 * Thinker / Practical / Leader balance checks for the recruited team.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 *
 * Rules (numbers from constants.json teamRules):
 * - no Practical  -> repair success modifier (e.g. −0.25)
 * - no Thinker    -> no "diagnose" action
 * - 2+ Leaders    -> morale drifts each turn (e.g. −2)
 * - 0 Leaders     -> fewer decision actions per turn (e.g. −1)
 */
import type { CrewMember, TeamRules } from '@/schemas'

export interface TeamModifiers {
  /** Added to repair success chance. */
  repairSuccess: number
  /** Added to decision actions per turn. */
  decisionActionsPerTurn: number
  /** Morale change per turn. */
  moraleDrift: number
  diagnoseAvailable: boolean
}

export interface TeamAnalysis {
  hasThinker: boolean
  hasPractical: boolean
  leaderCount: number
  modifiers: TeamModifiers
  /** Player-facing sentences. Empty when the team is balanced. */
  warnings: string[]
}

export function analyzeTeam(crew: readonly CrewMember[], rules: TeamRules): TeamAnalysis {
  const hasThinker = crew.some((c) => c.traits.includes('thinker'))
  const hasPractical = crew.some((c) => c.traits.includes('practical'))
  const leaderCount = crew.filter((c) => c.traits.includes('leader')).length
  const warnings: string[] = []

  if (!hasPractical) {
    warnings.push(
      `Nobody on the team is Practical, so repairs are ${pct(rules.noPracticalRepairSuccess)} less likely to succeed.`,
    )
  }
  if (!hasThinker) {
    warnings.push(
      'Nobody on the team is a Thinker, so you cannot diagnose a fault before fixing it.',
    )
  }
  if (leaderCount === 0) {
    warnings.push(
      `The team has no Leader, so you get ${Math.abs(rules.noLeaderDecisionActions)} fewer decision action each turn.`,
    )
  } else if (leaderCount >= 2) {
    warnings.push(
      `${leaderCount} Leaders will argue over decisions: morale drops by ${Math.abs(rules.multiLeaderMoraleDrift)} every turn.`,
    )
  }

  return {
    hasThinker,
    hasPractical,
    leaderCount,
    modifiers: {
      repairSuccess: hasPractical ? 0 : rules.noPracticalRepairSuccess,
      decisionActionsPerTurn: leaderCount === 0 ? rules.noLeaderDecisionActions : 0,
      moraleDrift: leaderCount >= 2 ? rules.multiLeaderMoraleDrift : 0,
      diagnoseAvailable: hasThinker,
    },
    warnings,
  }
}

function pct(ratio: number): string {
  return `${Math.round(Math.abs(ratio) * 100)}%`
}
