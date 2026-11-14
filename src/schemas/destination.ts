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
  /** Average share of time in sunlight, 0-1. */
  lightFraction: z
    .number()
    .min(0, { error: 'lightFraction must be >= 0' })
    .max(1, { error: 'lightFraction is a share of time and must be <= 1' }),
  /** Longest continuous dark period the base must survive on batteries, in hours. */
  darkPeriodHours: z.number().nonnegative({ error: 'darkPeriodHours must be >= 0' }),
  /** Fraction of solar output lost to dust each day (compounding), 0-1. */
  dustLossPerDay: z
    .number()
    .min(0, { error: 'dustLossPerDay must be >= 0' })
    .max(1, { error: 'dustLossPerDay must be <= 1' }),
  /** Hours per day with a link to Earth. */
  contactHoursPerDay: z
    .number()
    .min(0, { error: 'contactHoursPerDay must be >= 0' })
    .max(24, { error: 'contactHoursPerDay must be <= 24' }),
  resupplyPossible: z.boolean(),
  hazards: z.array(IdSchema),
  /** URL of the NASA page the numbers were taken from. */
  source: UrlSchema,
})

export type Destination = z.infer<typeof DestinationSchema>
