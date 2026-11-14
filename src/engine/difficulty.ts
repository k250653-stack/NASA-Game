/**
 * Difficulty modifiers (constants.json "difficulty"): budget multiplier, event chance multiplier,
 * NOVA hints. Pure TypeScript (CLAUDE.md rule 1).
 */
import type { Difficulty, DifficultyLevel, Scenario } from '@/schemas'
import type { EngineContent } from './types'

export function difficultyModifiers(
  difficulty: Difficulty,
  content: EngineContent,
): DifficultyLevel {
  return content.constants.difficulty[difficulty]
}

/** Budget available at this difficulty: scenario budget × budgetMultiplier, millions USD. */
export function effectiveBudgetM(
  scenario: Scenario,
  difficulty: Difficulty,
  content: EngineContent,
): number {
  return scenario.budgetM * difficultyModifiers(difficulty, content).budgetMultiplier
}
