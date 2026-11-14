import { z } from 'zod'
import { EffectSchema, IdSchema, NonEmptyString, RoleSchema, TraitSchema } from './shared'

/** Highest crew skill level. */
export const SKILL_MAX = 5

const SkillLevel = z
  .number()
  .int({ error: 'skill levels are whole numbers' })
  .min(0, { error: 'skill level must be >= 0' })
  .max(SKILL_MAX, { error: `skill level must be <= ${SKILL_MAX}` })

export const SkillsSchema = z.strictObject({
  power: SkillLevel,
  comms: SkillLevel,
  science: SkillLevel,
  systems: SkillLevel,
  navigation: SkillLevel,
})
export type Skills = z.infer<typeof SkillsSchema>

/** A trait with a human-readable text and a numeric effect the engine applies. */
export const TraitEffectSchema = z.strictObject({
  text: NonEmptyString,
  effect: EffectSchema,
})

const Weight = z.number().min(0).max(1)

export const PrioritiesSchema = z
  .strictObject({
    science: Weight,
    safety: Weight,
    cost: Weight,
  })
  .refine((p) => Math.abs(p.science + p.safety + p.cost - 1) < 1e-6, {
    error: 'priorities.science + safety + cost must sum to 1',
  })
export type Priorities = z.infer<typeof PrioritiesSchema>

export const CrewMemberSchema = z
  .strictObject({
    id: IdSchema,
    name: NonEmptyString,
    role: RoleSchema,
    /** Salary for the whole mission, millions USD. */
    salaryM: z.number().nonnegative({ error: 'salaryM must be >= 0 (millions USD)' }),
    traits: z.array(TraitSchema),
    skills: SkillsSchema,
    strength: TraitEffectSchema,
    weakness: TraitEffectSchema,
    priorities: PrioritiesSchema,
    backstory: NonEmptyString,
    /** Portrait asset id, resolved to public/assets/portraits/<portrait>.webp. */
    portrait: IdSchema,
    /**
     * The player's own character for one seat (not recruitable, no salary, no traits).
     * One per role plus the Mission Director; ids are player-<role>.
     */
    isPlayer: z.boolean().default(false),
    /** Short lines for the Negotiation panel, chosen deterministically. */
    dialogue: z
      .strictObject({
        accept: z.array(NonEmptyString).min(1),
        refuse: z.array(NonEmptyString).min(1),
        counter: z.array(NonEmptyString).min(1),
        request: z.array(NonEmptyString).min(1),
      })
      .optional(),
  })
  .refine((m) => m.isPlayer || m.traits.length > 0, {
    error: 'every recruitable crew member needs at least one trait',
  })
  .refine((m) => !m.isPlayer || m.salaryM === 0, { error: 'player characters have no salary' })

export type CrewMember = z.infer<typeof CrewMemberSchema>
