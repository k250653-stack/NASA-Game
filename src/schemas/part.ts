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

/** Stat keys the engine understands. A part lists only the ones it needs. */
export const PART_STAT_KEYS = [
  'ratedPowerW', // solar array output at 1 AU in full sun, W
  'capacityWh', // battery / fuel cell storage, Wh
  'dataRateMbps', // comms link rate, Mbps
  'scienceDataGbPerDay', // data an instrument produces, GB/day
  'sciencePointsPerDay', // science score an instrument or rover adds per day
  'waterRecoveryRate', // share of water recycled, 0-1
  'suitCount', // EVA suits provided
  'spareKits', // repair kits provided
  'storageKg', // supply storage the part provides, kg
  'crewCapacity', // crew the habitat can house
] as const
export const PartStatKeySchema = z.enum(PART_STAT_KEYS, {
  error: () => `stat key must be one of: ${PART_STAT_KEYS.join(', ')}`,
})
export type PartStatKey = z.infer<typeof PartStatKeySchema>

export const PartStatsSchema = z
  .partialRecord(PartStatKeySchema, z.number().nonnegative({ error: 'stats must be >= 0' }))
  .refine((s) => s.waterRecoveryRate === undefined || s.waterRecoveryRate <= 1, {
    error: 'stats.waterRecoveryRate is a share and must be <= 1',
  })

export const PartSchema = z.strictObject({
  id: IdSchema,
  name: NonEmptyString,
  category: PartCategorySchema,
  massKg: z.number().nonnegative({ error: 'massKg must be >= 0' }),
  /**
   * Constant electrical power in W. Negative = steady draw, positive = steady production that
   * does not depend on sunlight (e.g. fission). Solar arrays use 0 here and stats.ratedPowerW.
   */
  powerW: z.number(),
  costM: z.number().nonnegative({ error: 'costM must be >= 0 (millions USD)' }),
  /** Which crew role owns decisions about this part. */
  ownerRole: RoleSchema,
  /** Numeric stats the engine reads, e.g. { capacityWh: 50000 }. Only known keys allowed. */
  stats: PartStatsSchema,
  description: NonEmptyString,
  /** Tabler icon component name, e.g. "IconBattery". */
  icon: z.string().regex(/^Icon[A-Z][A-Za-z0-9]*$/, {
    error: 'icon must be a Tabler icon name such as "IconBattery"',
  }),
})

export type Part = z.infer<typeof PartSchema>
