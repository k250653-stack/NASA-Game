import { z } from 'zod'
import { PartCategorySchema } from './part'
import { NonEmptyString, ROLES } from './shared'

/** The seats a player can choose: the four crew roles plus the sandbox Mission Director. */
export const ROLE_CHOICES = [...ROLES, 'director'] as const
export const RoleChoiceSchema = z.enum(ROLE_CHOICES, {
  error: () => `role must be one of: ${ROLE_CHOICES.join(', ')}`,
})
export type RoleChoice = z.infer<typeof RoleChoiceSchema>

/** Theme colour tokens for roles (defined in src/index.css). */
export const ROLE_COLORS = [
  'role-science',
  'role-power',
  'role-comms',
  'role-budget',
  'role-director',
] as const

/** One entry in src/content/roles.json (Role select screen). */
export const RoleInfoSchema = z.strictObject({
  id: RoleChoiceSchema,
  name: NonEmptyString,
  /** Tabler icon name. */
  icon: z.string().regex(/^Icon[A-Z][A-Za-z0-9]*$/, { error: 'icon must be a Tabler icon name' }),
  color: z.enum(ROLE_COLORS),
  summary: NonEmptyString,
  controls: z.array(NonEmptyString).min(1),
  learn: z.array(NonEmptyString).min(1),
  difficultyHint: NonEmptyString,
  sandbox: z.boolean().default(false),
  /** What this seat controls on the Planning Board. */
  owns: z.strictObject({
    categories: z.array(PartCategorySchema),
    /** Packed water, food and oxygen. */
    supplies: z.boolean().default(false),
    rocket: z.boolean().default(false),
    /** May veto trades that push the team over budget. */
    budgetVeto: z.boolean().default(false),
  }),
  note: NonEmptyString.optional(),
})
export type RoleInfo = z.infer<typeof RoleInfoSchema>
