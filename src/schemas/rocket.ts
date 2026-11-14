import { z } from 'zod'
import { IdSchema, NonEmptyString, ProbabilitySchema, UrlSchema } from './shared'

export const RocketSchema = z.strictObject({
  id: IdSchema,
  name: NonEmptyString,
  /** Payload capacity in kg, keyed by destination id. A missing key means "cannot reach". */
  capacityKgByDestination: z
    .record(IdSchema, z.number().nonnegative({ error: 'capacity must be >= 0 kg' }))
    .refine((r) => Object.keys(r).length > 0, {
      error: 'capacityKgByDestination must list at least one destination',
    }),
  costM: z.number().nonnegative({ error: 'costM must be >= 0 (millions USD)' }),
  /** Probability of a nominal launch, 0-1. */
  reliability: ProbabilitySchema,
  /** URL the numbers came from, or a note on how they were estimated. */
  source: UrlSchema,
})

export type Rocket = z.infer<typeof RocketSchema>
