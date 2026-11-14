import { z } from 'zod'
import { IdSchema, NonEmptyString } from './shared'

export const DIFFICULTIES = ['cadet', 'engineer', 'flight_director'] as const
export const DifficultySchema = z.enum(DIFFICULTIES, {
  error: () => `difficulty must be one of: ${DIFFICULTIES.join(', ')}`,
})
export type Difficulty = z.infer<typeof DifficultySchema>

export const ScenarioSchema = z.strictObject({
  id: IdSchema,
  /** Must match an id in destinations.json (checked in content/load.ts). */
  destinationId: IdSchema,
  name: NonEmptyString,
  objective: NonEmptyString,
  /** Surface mission length in days. */
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
})

export type Scenario = z.infer<typeof ScenarioSchema>
