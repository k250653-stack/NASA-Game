import { z } from 'zod'
import {
  EffectsSchema,
  IdSchema,
  NonEmptyString,
  ProbabilitySchema,
  RoleSchema,
  SkillKeySchema,
} from './shared'

export const EVENT_TYPES = ['technical', 'environmental', 'human', 'science'] as const
export const EventTypeSchema = z.enum(EVENT_TYPES, {
  error: () => `type must be one of: ${EVENT_TYPES.join(', ')}`,
})
export type EventType = z.infer<typeof EventTypeSchema>

export const EventTriggerSchema = z
  .strictObject({
    minDay: z.number().int().nonnegative({ error: 'minDay must be an integer >= 0' }),
    maxDay: z.number().int().nonnegative({ error: 'maxDay must be an integer >= 0' }),
    /** Per-day chance of firing while inside [minDay, maxDay]. */
    chance: ProbabilitySchema,
    /** Optional engine condition key, e.g. "afterEva" or "powerBelow20". */
    condition: NonEmptyString.optional(),
  })
  .refine((t) => t.maxDay >= t.minDay, { error: 'trigger.maxDay must be >= trigger.minDay' })

export const EventOptionSchema = z.strictObject({
  label: NonEmptyString,
  /** Crew skill that improves the odds, if any. */
  crewSkill: SkillKeySchema.optional(),
  /** Resources spent to attempt this option, e.g. { evaHours: 2, powerWh: 500 }. */
  uses: z.record(NonEmptyString, z.number().nonnegative({ error: 'resource use must be >= 0' })),
  successChance: ProbabilitySchema,
  onSuccess: EffectsSchema,
  onFail: EffectsSchema,
  /** The real-world reason this option works or fails. Shown in the Failure Review. */
  explanation: NonEmptyString,
})
export type EventOption = z.infer<typeof EventOptionSchema>

export const GameEventSchema = z.strictObject({
  id: IdSchema,
  title: NonEmptyString,
  description: NonEmptyString,
  type: EventTypeSchema,
  /** The crew role that must respond. */
  role: RoleSchema,
  /** Destination ids where this event can occur (checked in content/load.ts). */
  destinations: z.array(IdSchema).min(1, { error: 'event must list at least one destination' }),
  trigger: EventTriggerSchema,
  options: z.array(EventOptionSchema).min(1, { error: 'event must offer at least one option' }),
})

export type GameEvent = z.infer<typeof GameEventSchema>
