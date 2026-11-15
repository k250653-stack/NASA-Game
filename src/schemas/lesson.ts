import { z } from 'zod'
import { IdSchema, NonEmptyString, RoleSchema, UrlSchema } from './shared'

export const VIZ_KINDS = ['orbit', 'power', 'signal', 'mass', 'life_support'] as const
export const VizKindSchema = z.enum(VIZ_KINDS, {
  error: () => `viz must be one of: ${VIZ_KINDS.join(', ')}`,
})
export type VizKind = z.infer<typeof VizKindSchema>

export const PredictQuestionSchema = z
  .strictObject({
    question: NonEmptyString,
    options: z.array(NonEmptyString).min(2, { error: 'a prediction needs at least 2 options' }),
    correctIndex: z.number().int().nonnegative({ error: 'correctIndex must be an integer >= 0' }),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    error: 'correctIndex must point at one of the options',
  })

export const LessonSchema = z.strictObject({
  id: IdSchema,
  title: NonEmptyString,
  role: RoleSchema,
  /** Engine trigger key that opens this lesson, e.g. "launch_check_open". */
  trigger: NonEmptyString,
  predictQuestion: PredictQuestionSchema,
  /** Short explanation steps, one sentence each. */
  steps: z.array(NonEmptyString).min(1, { error: 'a lesson needs at least one step' }),
  viz: VizKindSchema,
  /** Parameters passed to the viz component. */
  vizParams: z.record(NonEmptyString, z.union([z.number(), z.string(), z.boolean()])),
  formulaLatex: NonEmptyString,
  /** Text with {placeholders} filled from the player's current design. */
  applyTemplate: NonEmptyString,
  /** Every lesson must cite a source (CLAUDE.md rule 5); "TODO: verify" until a URL is checked. */
  source: z.union([UrlSchema, z.literal('TODO: verify')]),
})

export type Lesson = z.infer<typeof LessonSchema>
