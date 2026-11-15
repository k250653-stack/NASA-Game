import { z } from 'zod'
import { IdSchema, NonEmptyString } from './shared'

/** Gauge ids a line can react to (world/mission/missionRun gauges). */
export const DIALOGUE_RESOURCES = ['power', 'battery', 'water', 'food', 'oxygen'] as const

const WhenSchema = z.strictObject({
  minDay: z.number().nonnegative().optional(),
  maxDay: z.number().nonnegative().optional(),
  destination: IdSchema.optional(),
  /** Mission phase id (destinations.json phases[].id). */
  phase: IdSchema.optional(),
  /** Fires when this supply/power bar is low or critical. */
  lowResource: z.enum(DIALOGUE_RESOURCES).optional(),
  /** Crew member's morale (0-100) is below this. */
  moraleBelow: z.number().min(0).max(100).optional(),
  /** This event fired within the last few turns (constants.dialogue.recentTurns). */
  recentEvent: IdSchema.optional(),
  minTrust: z.number().min(0).optional(),
  maxTrust: z.number().min(0).optional(),
})

const ChoiceSchema = z.strictObject({
  text: NonEmptyString,
  /** What the crew member answers (one short line). */
  reply: NonEmptyString,
  /** Trust change for this member (applied through the store). */
  trust: z.number().default(0),
  /** Morale change for this member (applied through the engine). */
  morale: z.number().default(0),
  /** Starts this side mission (sideMissions.json id). */
  startSideMission: IdSchema.optional(),
})

export const DialogueLineSchema = z.strictObject({
  id: IdSchema,
  crewId: IdSchema,
  /** "normal" every day, "event"/"resource" reactions (shown first when they match). */
  kind: z.enum(['normal', 'event', 'resource']),
  text: NonEmptyString,
  when: WhenSchema.default({}),
  /** A real fact the line teaches (just a marker for content review). */
  fact: z.boolean().default(false),
  choices: z.array(ChoiceSchema).min(1).max(3),
})
export type DialogueLine = z.infer<typeof DialogueLineSchema>

export const SIDE_KINDS = ['visit_station', 'avoid_eva'] as const

/** Optional small tasks started from a crew member's dialogue. */
export const SideMissionSchema = z.strictObject({
  id: IdSchema,
  crewId: IdSchema,
  title: NonEmptyString,
  /** One line in the task list. */
  brief: NonEmptyString,
  kind: z.enum(SIDE_KINDS),
  /** visit_station: the habitat station to visit (same ids as workstations). */
  station: z.enum(['power', 'comms', 'science', 'repair', 'airlock']).optional(),
  /** visit_station: only counts on a calm turn (no problem pending). */
  calmOnly: z.boolean().default(false),
  /** visit_station: visits on this many turns in a row. avoid_eva: turns to get through. */
  turns: z.number().int().positive(),
  rewardMorale: z.number().default(0),
  rewardTrust: z.number().default(0),
  /** What the crew member says the day after it is done. */
  followUp: NonEmptyString,
})
export type SideMission = z.infer<typeof SideMissionSchema>
