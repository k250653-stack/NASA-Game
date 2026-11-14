import { z } from 'zod'
import { IdSchema, NonEmptyString, UrlSchema } from './shared'

export const LOCATIONS = ['transit', 'surface'] as const
export const LocationSchema = z.enum(LOCATIONS, {
  error: () => `location must be one of: ${LOCATIONS.join(', ')}`,
})
export type Location = z.infer<typeof LocationSchema>

/** One leg of the mission, simulated in turns of turnDays (the last turn may be shorter). */
export const MissionPhaseSchema = z
  .strictObject({
    id: IdSchema,
    name: NonEmptyString,
    days: z.number().int().positive({ error: 'phase days must be a positive integer' }),
    turnDays: z.number().int().positive({ error: 'turnDays must be a positive integer' }),
    location: LocationSchema,
    /** Events tagged with this can fire during the phase. */
    eventsTag: IdSchema,
  })
  .refine((p) => p.turnDays <= p.days, { error: 'turnDays must be <= the phase days' })
export type MissionPhase = z.infer<typeof MissionPhaseSchema>

export const DestinationSchema = z.strictObject({
  id: IdSchema,
  name: NonEmptyString,
  /** One-line pitch on the Destination select card. */
  pitch: NonEmptyString,
  /** Badge on the Destination select card, e.g. "Recommended first mission". */
  recommendation: z.strictObject({
    label: NonEmptyString,
    tone: z.enum(['success', 'warning', 'info']),
  }),
  /** Approximate one-way transit time in days. */
  transitDays: z.number().positive({ error: 'transitDays must be a positive number of days' }),
  /** Approximate one-way light-time delay in seconds (typical value). */
  signalDelaySec: z.number().nonnegative({ error: 'signalDelaySec must be >= 0' }),
  /** One-way delay range [closest, farthest] over the mission, seconds. */
  signalDelayRangeSec: z
    .tuple([z.number().nonnegative(), z.number().nonnegative()])
    .refine(([min, max]) => min <= max, { error: 'signalDelayRangeSec must be [min, max]' }),
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
  /** Hours per day with a link to Earth while in transit (usually less DSN time). */
  transitContactHoursPerDay: z
    .number()
    .min(0, { error: 'transitContactHoursPerDay must be >= 0' })
    .max(24, { error: 'transitContactHoursPerDay must be <= 24' }),
  /** Mission legs in order. Their days must add up to each scenario's durationDays. */
  phases: z.array(MissionPhaseSchema).min(1, { error: 'a destination needs at least one phase' }),
  resupplyPossible: z.boolean(),
  hazards: z.array(IdSchema),
  /** URL of the NASA page the numbers were taken from. */
  source: UrlSchema,
})

export type Destination = z.infer<typeof DestinationSchema>
