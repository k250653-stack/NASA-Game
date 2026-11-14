import { z } from 'zod'
import { NonEmptyString } from './shared'

/** A single tunable number plus where it came from. */
const Sourced = z.strictObject({
  value: z.number(),
  source: NonEmptyString,
})

const NonNegKg = z.number().nonnegative({ error: 'must be >= 0 kg' })

/** Global engine constants: src/content/constants.json. */
export const ConstantsSchema = z.strictObject({
  _note: z.string().optional(),
  /** Consumables one crew member uses per day. */
  perCrewPerDay: z.strictObject({
    oxygenKg: NonNegKg,
    foodKg: NonNegKg,
    waterKg: NonNegKg,
    source: NonEmptyString,
  }),
  /** Extra days of supplies required beyond the mission duration. */
  reserveDaysRequired: Sourced,
  /** Power margin below this ratio triggers a warning. */
  powerMarginTarget: Sourced,
  /** Mass margin below this ratio triggers a warning. */
  massMarginTarget: Sourced,
  /** Mass of one crew member including personal gear, kg. */
  crewMassKg: Sourced,
  /** Data check warns when less than this share of generated data can be returned. */
  dataReturnWarnRatio: Sourced,
  /** Crew with at least this systems skill count as EVA-capable (need a suit). */
  evaMinSystemsSkill: Sourced,
  /** Team-balance modifiers (see engine/teamBalance.ts). */
  teamRules: z.strictObject({
    noPracticalRepairSuccess: z.number(),
    noLeaderDecisionActions: z.number(),
    multiLeaderMoraleDrift: z.number(),
    source: NonEmptyString,
  }),
  /** Who can answer events live. */
  settings: z.strictObject({
    /** Destinations close enough for the player to answer urgent events live. */
    liveResponseDestinations: z.array(z.string()),
    /** One-way delay above which urgent events are handled by standing orders, seconds. */
    delayThresholdSec: z.number().nonnegative(),
    source: NonEmptyString,
  }),
  /** Turn-loop tuning (see engine/mission.ts and engine/events.ts). */
  mission: z.strictObject({
    startMorale: z.number().min(0).max(100),
    energyRecoveryPerDay: z.number().nonnegative(),
    healthRecoveryPerDay: z.number().nonnegative(),
    /** Health lost per day when life support has no power. */
    healthLossPerDayNoLifeSupport: z.number().nonnegative(),
    /** Crew below this health count as injured (crewInjury "rest" keeps them inside). */
    injuredHealthBelow: z.number().min(0).max(100),
    maxEventsPerTurn: z.number().int().nonnegative(),
    weaknessChanceMultiplier: z.number().positive(),
    skillBonusPerLevel: z.number().nonnegative(),
    traitBonus: z.number().nonnegative(),
    /** Success penalty at 0 energy; scales linearly with tiredness. */
    fatiguePenaltyMax: z.number().nonnegative(),
    minSuccess: z.number().min(0).max(1),
    maxSuccess: z.number().min(0).max(1),
    /** Onboard storage for science data waiting to be sent, GB. */
    dataStorageGb: z.number().nonnegative(),
    rationFoodFactor: z.number().min(0).max(1),
    rationMoralePerTurn: z.number(),
    /** Average morale below this cuts science output. */
    lowMoraleThreshold: z.number().min(0).max(100),
    lowMoraleScienceFactor: z.number().min(0).max(1),
    /** Share of time in sunlight while in transit (deep space: no night). */
    transitLightFraction: z.number().min(0).max(1),
    source: NonEmptyString,
  }),
})

export type Constants = z.infer<typeof ConstantsSchema>
export type MissionTuning = Constants['mission']
export type PerCrewPerDay = Constants['perCrewPerDay']
export type TeamRules = Constants['teamRules']
