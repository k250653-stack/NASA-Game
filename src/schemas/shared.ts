import { z } from 'zod'

/** Building blocks shared by several content schemas. */

export const ROLES = ['science', 'power_life', 'comms_nav', 'launch_budget'] as const
export const RoleSchema = z.enum(ROLES, {
  error: () => `role must be one of: ${ROLES.join(', ')}`,
})
export type Role = z.infer<typeof RoleSchema>

export const TRAITS = ['thinker', 'practical', 'leader'] as const
export const TraitSchema = z.enum(TRAITS, {
  error: () => `trait must be one of: ${TRAITS.join(', ')}`,
})
export type Trait = z.infer<typeof TraitSchema>

export const SKILL_KEYS = ['power', 'comms', 'science', 'systems', 'navigation'] as const
export const SkillKeySchema = z.enum(SKILL_KEYS, {
  error: () => `skill must be one of: ${SKILL_KEYS.join(', ')}`,
})
export type SkillKey = z.infer<typeof SkillKeySchema>

/** Kebab-case identifier, e.g. "moon", "ice-drill-spectrometer". */
export const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  error: 'id must be kebab-case: lowercase letters, digits and single hyphens (e.g. "ice-drill")',
})

export const NonEmptyString = z.string().trim().min(1, { error: 'must not be empty' })

export const UrlSchema = z.url({ error: 'must be a full URL (https://...)' })

/** A probability in [0, 1]. */
export const ProbabilitySchema = z
  .number()
  .min(0, { error: 'probability must be >= 0' })
  .max(1, { error: 'probability must be <= 1' })

/** A single named numeric effect, e.g. { key: "scienceYield", value: 0.1 }. */
export const EffectSchema = z.strictObject({
  key: NonEmptyString,
  value: z.number(),
})
export type Effect = z.infer<typeof EffectSchema>

/** A bag of effects keyed by stat/resource name -> delta, e.g. { powerFactor: -0.1 }. */
export const EffectsSchema = z.record(NonEmptyString, z.number())
export type Effects = z.infer<typeof EffectsSchema>
