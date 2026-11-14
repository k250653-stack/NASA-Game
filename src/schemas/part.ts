import { z } from 'zod'
import { IdSchema, NonEmptyString, RoleSchema } from './shared'

export const PART_CATEGORIES = [
  'instrument',
  'power',
  'battery',
  'comms',
  'life_support',
  'suit',
  'spares',
  'rover',
  'habitat',
] as const
export const PartCategorySchema = z.enum(PART_CATEGORIES, {
  error: () => `category must be one of: ${PART_CATEGORIES.join(', ')}`,
})
export type PartCategory = z.infer<typeof PartCategorySchema>

export const PartSchema = z.strictObject({
  id: IdSchema,
  name: NonEmptyString,
  category: PartCategorySchema,
  massKg: z.number().nonnegative({ error: 'massKg must be >= 0' }),
  /** Watts. Negative = consumes power, positive = produces power. */
  powerW: z.number(),
  costM: z.number().nonnegative({ error: 'costM must be >= 0 (millions USD)' }),
  /** Which crew role owns decisions about this part. */
  ownerRole: RoleSchema,
  /** Free-form numeric stats the engine reads, e.g. { sciencePerDay: 4 }. */
  stats: z.record(NonEmptyString, z.number()),
  description: NonEmptyString,
  /** Tabler icon component name, e.g. "IconBattery". */
  icon: z.string().regex(/^Icon[A-Z][A-Za-z0-9]*$/, {
    error: 'icon must be a Tabler icon name such as "IconBattery"',
  }),
})

export type Part = z.infer<typeof PartSchema>
