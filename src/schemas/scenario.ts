import { z } from 'zod'
import { IdSchema, NonEmptyString } from './shared'
import { StandingOrdersSchema } from './standingOrders'

export const DIFFICULTIES = ['cadet', 'engineer', 'flight_director'] as const
export const DifficultySchema = z.enum(DIFFICULTIES, {
  error: () => `difficulty must be one of: ${DIFFICULTIES.join(', ')}`,
})
export type Difficulty = z.infer<typeof DifficultySchema>

/** Conditions the engine can check at the debrief (see engine/score.ts). */
export const BONUS_CONDITIONS = [
  'allDataReturned', // no data lost and nothing left in the backlog
  'noInjuries', // no crew member lost health to an event or a failure
  'underBudgetPct', // finished with at least value% of the budget unspent
  'scienceAbovePct', // returned science >= value% of the target
  'noCrewLost', // every crew member came home
] as const

export const BonusObjectiveSchema = z.strictObject({
  id: IdSchema,
  label: NonEmptyString,
  condition: z.enum(BONUS_CONDITIONS, {
    error: () => `condition must be one of: ${BONUS_CONDITIONS.join(', ')}`,
  }),
  value: z.number().optional(),
  points: z.number().positive(),
})
export type BonusObjective = z.infer<typeof BonusObjectiveSchema>

export const ScenarioSchema = z.strictObject({
  id: IdSchema,
  /** Must match an id in destinations.json (checked in content/load.ts). */
  destinationId: IdSchema,
  name: NonEmptyString,
  objective: NonEmptyString,
  /** Whole mission length in days (equals the sum of the destination's phase days). */
  durationDays: z.number().int().positive({ error: 'durationDays must be a positive integer' }),
  crewSize: z
    .number()
    .int()
    .min(1, { error: 'crewSize must be at least 1' })
    .max(8, { error: 'crewSize must be at most 8' }),
  /** Total budget in millions of dollars. */
  budgetM: z.number().positive({ error: 'budgetM must be a positive number (millions USD)' }),
  /** Science points needed for full mission success. */
  scienceTarget: z.number().positive({ error: 'scienceTarget must be > 0' }),
  difficulty: DifficultySchema,
  /** Standing orders a new design starts with; the player can change them. */
  defaultStandingOrders: StandingOrdersSchema,
  /** Extra points at the debrief (added to the total, capped at 100). */
  bonusObjectives: z.array(BonusObjectiveSchema).default([]),
})

export type Scenario = z.infer<typeof ScenarioSchema>
