import { z } from 'zod'
import { PART_CATEGORIES, PartCategorySchema } from './part'
import {
  IdSchema,
  NonEmptyString,
  ProbabilitySchema,
  RoleSchema,
  SkillKeySchema,
  TraitSchema,
} from './shared'

export const EVENT_TYPES = ['technical', 'environmental', 'human', 'science'] as const
export const EventTypeSchema = z.enum(EVENT_TYPES, {
  error: () => `type must be one of: ${EVENT_TYPES.join(', ')}`,
})
export type EventType = z.infer<typeof EventTypeSchema>

export const URGENCIES = ['urgent', 'routine'] as const
export const EVENT_LOCATIONS = ['transit', 'surface', 'any'] as const

/** Design weaknesses that make an event more likely (chance × weaknessChanceMultiplier). */
export const WEAKNESSES = ['power', 'life_support', 'comms', 'eva'] as const
export type Weakness = (typeof WEAKNESSES)[number]

/** Mission resources an effect can change. */
export const RESOURCE_KEYS = [
  'batteryWh',
  'waterKg',
  'foodKg',
  'oxygenKg',
  'suits',
  'spareKits',
  'scienceGb',
  'sciencePoints',
  'dataBacklogGb',
] as const
export type ResourceKey = (typeof RESOURCE_KEYS)[number]

/** Temporary multipliers (op "multiply" with durationTurns). */
export const MODIFIER_KEYS = [
  'solarOutput',
  'powerUse',
  'dataRate',
  'scienceRate',
  'lifeSupportUse',
] as const
export type ModifierKey = (typeof MODIFIER_KEYS)[number]

export const CREW_TARGETS = ['randomCrew', 'allCrew', 'actingCrew'] as const
export const CREW_STATS = ['energy', 'morale', 'health'] as const
export type CrewStat = (typeof CREW_STATS)[number]

const PART_TARGET = new RegExp(`^part:(${PART_CATEGORIES.join('|')})$`)

/** True when the target is a crew member (named id or randomCrew/allCrew/actingCrew). */
export function isCrewTarget(target: string): boolean {
  return (
    !(RESOURCE_KEYS as readonly string[]).includes(target) &&
    !(MODIFIER_KEYS as readonly string[]).includes(target) &&
    target !== 'dustLevel' &&
    !PART_TARGET.test(target)
  )
}

export const EffectTargetSchema = z.union(
  [
    z.enum(RESOURCE_KEYS),
    z.enum(MODIFIER_KEYS),
    z.enum(CREW_TARGETS),
    z.literal('dustLevel'),
    z.string().regex(PART_TARGET),
    IdSchema,
  ],
  {
    error:
      'target must be a resource, a modifier, randomCrew/allCrew/actingCrew, dustLevel, part:<category> or a crew id',
  },
)

export const EventEffectSchema = z
  .strictObject({
    target: EffectTargetSchema,
    /** Required for crew targets. */
    stat: z.enum(CREW_STATS).optional(),
    op: z.enum(['add', 'multiply', 'set', 'disable']),
    value: z.number(),
    durationTurns: z.number().int().positive().optional(),
  })
  .refine((e) => !isCrewTarget(e.target) || e.stat !== undefined, {
    error: 'crew effects need a stat (energy, morale or health)',
  })
  .refine((e) => isCrewTarget(e.target) || e.stat === undefined, {
    error: 'stat is only allowed on crew effects',
  })
  .refine((e) => PART_TARGET.test(e.target) === (e.op === 'disable'), {
    error: 'op "disable" is used with part:<category> targets, and only with them',
  })
  .refine((e) => !(MODIFIER_KEYS as readonly string[]).includes(e.target) || e.op === 'multiply', {
    error: 'modifier targets (solarOutput, dataRate, ...) only support op "multiply"',
  })
export type EventEffect = z.infer<typeof EventEffectSchema>

export const CONDITION_KEYS = [
  'powerMarginBelow',
  'noSpares',
  'suitsBelow',
  'recyclerInstalled',
  'dayAfter',
  'lowMorale',
  'dustLevelAbove',
  'leadersAtLeast',
] as const
const VALUELESS = ['noSpares', 'recyclerInstalled']

export const EventConditionSchema = z
  .strictObject({
    key: z.enum(CONDITION_KEYS, {
      error: () => `condition key must be one of: ${CONDITION_KEYS.join(', ')}`,
    }),
    value: z.number().optional(),
  })
  .refine((c) => VALUELESS.includes(c.key) || c.value !== undefined, {
    error: 'this condition needs a value',
  })
export type EventCondition = z.infer<typeof EventConditionSchema>

export const EventTriggerSchema = z
  .strictObject({
    minDay: z.number().int().nonnegative({ error: 'minDay must be an integer >= 0' }),
    maxDay: z.number().int().nonnegative({ error: 'maxDay must be an integer >= 0' }),
    /** Chance of firing per turn while eligible (before weakness scaling). */
    chance: ProbabilitySchema,
    /** All must hold for the event to be eligible. */
    conditions: z.array(EventConditionSchema).default([]),
  })
  .refine((t) => t.maxDay >= t.minDay, { error: 'trigger.maxDay must be >= trigger.minDay' })

const Count = z.number().nonnegative({ error: 'must be >= 0' })
export const ConsumesSchema = z.strictObject({
  suits: Count.optional(),
  spareKits: Count.optional(),
  /** Days of food for the whole crew. */
  rationDays: Count.optional(),
  powerWh: Count.optional(),
  /** Energy taken from the crew member who acts. */
  crewEnergy: Count.optional(),
})
export type Consumes = z.infer<typeof ConsumesSchema>

/** Tags let standing orders steer the AI (e.g. crewInjury "rest" prefers "rest" options). */
export const OPTION_TAGS = [
  'eva',
  'repair',
  'rest',
  'continue',
  'shed_science',
  'wait',
  'ration',
] as const
export type OptionTag = (typeof OPTION_TAGS)[number]

export const EventOptionSchema = z.strictObject({
  id: IdSchema,
  label: NonEmptyString,
  requiresTrait: TraitSchema.optional(),
  /** A part category (e.g. "suit") or a specific part id (e.g. "radiation-shelter"). */
  requiresPart: z.union([PartCategorySchema, IdSchema]).optional(),
  consumes: ConsumesSchema.default({}),
  baseSuccess: ProbabilitySchema,
  /** Skill of the acting crew member that improves the odds. */
  skill: SkillKeySchema.optional(),
  tags: z.array(z.enum(OPTION_TAGS)).default([]),
  onSuccess: z.array(EventEffectSchema),
  onFail: z.array(EventEffectSchema),
  /** The real-world reason this option works or fails. Shown in the log and Failure Review. */
  explanation: NonEmptyString,
})
export type EventOption = z.infer<typeof EventOptionSchema>

export const GameEventSchema = z
  .strictObject({
    id: IdSchema,
    title: NonEmptyString,
    description: NonEmptyString,
    type: EventTypeSchema,
    /** The crew role that must respond. */
    role: RoleSchema,
    /** Destination ids where this event can occur (checked in content/load.ts). */
    destinations: z.array(IdSchema).min(1, { error: 'event must list at least one destination' }),
    location: z.enum(EVENT_LOCATIONS),
    urgency: z.enum(URGENCIES),
    /** Good news events (discoveries, morale boosts). */
    positive: z.boolean().default(false),
    weakness: z.enum(WEAKNESSES).optional(),
    /** Only fires if the design carries a part of this category (e.g. "rover"). */
    requiresPartCategory: PartCategorySchema.optional(),
    /**
     * Fires when a working part of this category fails its stats.failureChancePerTurn roll,
     * instead of using trigger.chance: chance = 1 − Π(1 − failureChancePerTurn).
     */
    partFailureCategory: PartCategorySchema.optional(),
    trigger: EventTriggerSchema,
    cooldownTurns: z.number().int().nonnegative(),
    maxOccurrences: z.number().int().positive(),
    options: z.array(EventOptionSchema).min(1, { error: 'event must offer at least one option' }),
  })
  .refine((e) => new Set(e.options.map((o) => o.id)).size === e.options.length, {
    error: 'option ids must be unique within an event',
  })

export type GameEvent = z.infer<typeof GameEventSchema>
