import { z } from 'zod'
import { IdSchema, NonEmptyString, UrlSchema } from './shared'

/** Short contextual NOVA tips and science facts (nova/tips.ts). */
export const NovaTipSchema = z.strictObject({
  id: IdSchema,
  /** Game situation that shows it, e.g. "room:personnel", "event:power", "quiet" (facts). */
  trigger: NonEmptyString,
  /** "tip" = situation help; "fact" = a real-science note with a source. */
  kind: z.enum(['tip', 'fact']),
  /** One or two short lines. */
  text: NonEmptyString,
  /** Lesson (lessons.json id) opened by "Learn more", if any. */
  lessonId: IdSchema.optional(),
  /** Still shown when NOVA tips are set to "Some" (the important ones). */
  important: z.boolean().default(false),
  source: z.union([UrlSchema, z.literal('TODO: verify')]).optional(),
})
export type NovaTip = z.infer<typeof NovaTipSchema>
