import { z } from 'zod'
import { PartCategorySchema } from './part'
import { IdSchema } from './shared'

const Percent = z.number().min(0).max(100)

/** Where parts appear on the base illustration (src/content/baseSlots.json). */
export const BaseSlotsSchema = z.strictObject({
  id: IdSchema,
  /** Destination id (checked in content/load.ts). */
  destinationId: IdSchema,
  slots: z.array(
    z.strictObject({
      slotId: IdSchema,
      category: PartCategorySchema,
      /** Position in percent of the base image width and height. */
      x: Percent,
      y: Percent,
    }),
  ),
})
export type BaseSlots = z.infer<typeof BaseSlotsSchema>
