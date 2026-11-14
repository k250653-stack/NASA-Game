import { z } from 'zod'
import { IdSchema, NonEmptyString, UrlSchema } from './shared'

export const DestinationSchema = z.strictObject({
  id: IdSchema,
  name: NonEmptyString,
  /** Approximate one-way transit time in days. */
  transitDays: z.number().positive({ error: 'transitDays must be a positive number of days' }),
  /** Approximate one-way light-time delay in seconds. */
  signalDelaySec: z.number().nonnegative({ error: 'signalDelaySec must be >= 0' }),
  /** Solar irradiance relative to Earth orbit (1.0 = same as Earth). */
  sunlightFactor: z.number().positive({ error: 'sunlightFactor must be > 0 (1.0 = Earth orbit)' }),
  /** Surface gravity in Earth g. */
  gravityG: z
    .number()
    .positive({ error: 'gravityG must be > 0' })
    .max(1, { error: 'gravityG is in Earth g and must be <= 1 for Moon/Mars' }),
  resupplyPossible: z.boolean(),
  hazards: z.array(IdSchema),
  /** URL of the NASA page the numbers were taken from. */
  source: UrlSchema,
})

export type Destination = z.infer<typeof DestinationSchema>
