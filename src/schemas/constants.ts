import { z } from 'zod'
import { NonEmptyString } from './shared'

/** A single tunable number plus where it came from. */
const Sourced = z.strictObject({
  value: z.number(),
  source: NonEmptyString,
})

const NonNegKg = z.number().nonnegative({ error: 'must be >= 0 kg' })

/** Global engine constants: src/content/constants.json. */
const PacingSchema = z.strictObject({
  /** An event is forced in the turn that reaches this day if none has fired yet. */
  firstEventByDay: z.number().nonnegative(),
  /** Rolled events are dropped while fewer days than this have passed since the last one. */
  minEventGapDays: z.number().nonnegative(),
  /** An event is forced when the quiet stretch would grow past this many days. */
  maxEventGapDays: z.number().positive(),
})

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
    /**
     * Every event goes to the player: their own role as a decision, a teammate's as a proposal to
     * approve or override. False = teammates resolve their own events silently (old behaviour).
     */
    playerApprovesAllEvents: z.boolean(),
    source: NonEmptyString,
  }),
  /** Alert layer while problems are pending (ui/alertLayer): event id lists per sound category. */
  alert: z.strictObject({
    categories: z.strictObject({
      power: z.array(z.string()),
      comms: z.array(z.string()),
      crew: z.array(z.string()),
      environment: z.array(z.string()),
    }),
    /** Soft alarm beep interval, seconds. */
    beepEverySec: z.number().positive(),
    /** Fade-out once nothing is pending, seconds. */
    fadeOutSec: z.number().positive(),
    /** Loudness of the drone at full music volume (kept low). */
    level: z.number().min(0).max(1),
    source: NonEmptyString,
  }),
  /** Player movement (world/player): speed factor on the pack walk, and the Shift multiplier. */
  player: z.strictObject({
    walkSpeedFactor: z.number().positive(),
    sprintMultiplier: z.number().min(1),
    source: NonEmptyString,
  }),
  /** Repair timing mini-game (world/mission/RepairTiming): which options, and the bonus for a hit. */
  minigame: z.strictObject({
    eventIds: z.array(z.string()),
    /** Options with this tag get the timing bar. */
    optionTag: z.string(),
    /** Added to the success chance on a hit (0.15 = +15 points). */
    hitBonus: z.number().min(0).max(1),
    /** The bonus never pushes the chance above this. */
    maxChance: z.number().min(0).max(1),
    /** The bar stops by itself (a miss) after this long, ms. */
    durationMs: z.number().positive(),
    /** Time for the marker to cross the bar once, ms. */
    sweepMs: z.number().positive(),
    /** Smallest green zone, as a share of the bar. */
    minZone: z.number().min(0).max(1),
    source: NonEmptyString,
  }),
  /**
   * Event pacing (engine/events.ts applyPacing): a first event early, then neither too close
   * together nor too far apart. Days are mission days; per destination, else default.
   */
  pacing: z.strictObject({
    default: PacingSchema,
    byDestination: z.record(z.string(), PacingSchema),
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

const Ratio = z.number().min(0).max(1)
const Band = z
  .strictObject({ min: z.number(), max: z.number() })
  .refine((b) => b.min <= b.max, { error: 'band min must be <= max' })

/** Scoring tuning (see engine/score.ts). */
export const ScoringSchema = z
  .strictObject({
    weights: z.strictObject({ science: Ratio, safety: Ratio, efficiency: Ratio, teamwork: Ratio }),
    outcomeThresholds: z.strictObject({ success: z.number(), partial: z.number() }),
    /** Totals needed for 1, 2 and 3 stars. */
    starThresholds: z.tuple([z.number(), z.number(), z.number()]),
    /** A failed mission's total never exceeds this. */
    failedCap: z.number(),
    /** Safety points lost per crew member whose health reached 0. */
    deathPenalty: z.number().nonnegative(),
    /** Safety points per day of supplies left at the end, up to reserveMaxPoints. */
    reservePointsPerDay: z.number().nonnegative(),
    reserveMaxPoints: z.number().nonnegative(),
    /** Mass margin in this band scores 100; outside it drops off. */
    massMarginBand: Band,
    /** Power margin in this band scores 100; outside it drops off. */
    powerMarginBand: Band,
    conflictPenalty: z.number().nonnegative(),
    tradeBonus: z.number().nonnegative(),
    /** Events that count as crew conflicts for teamwork. */
    conflictEventIds: z.array(z.string()),
    source: NonEmptyString,
  })
  .refine(
    (s) =>
      Math.abs(
        s.weights.science + s.weights.safety + s.weights.efficiency + s.weights.teamwork - 1,
      ) < 1e-6,
    { error: 'scoring.weights must sum to 1' },
  )

/** One difficulty level (Cadet / Engineer / Flight Director). */
const DifficultyLevelSchema = z.strictObject({
  label: NonEmptyString,
  description: NonEmptyString,
  /** Scenario budget × this. */
  budgetMultiplier: z.number().positive(),
  /** Event trigger chances × this (part failures are not scaled). */
  eventChanceMultiplier: z.number().nonnegative(),
  /** NOVA hints shown during the mission. */
  hintsEnabled: z.boolean(),
})
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>

export const ConstantsWithScoringSchema = ConstantsSchema.extend({
  scoring: ScoringSchema,
  /** Go / No-Go poll thresholds (engine/launchPoll.ts). */
  launch: z.strictObject({
    /** Rocket reliability below this makes Launch & Budget raise a concern. */
    reliabilityConcernBelow: z.number().min(0).max(1),
    /** Expected science below this share of the target makes Science raise a concern. */
    scienceConcernBelow: z.number().min(0),
    source: NonEmptyString,
  }),
  difficulty: z.strictObject({
    cadet: DifficultyLevelSchema,
    engineer: DifficultyLevelSchema,
    flight_director: DifficultyLevelSchema,
  }),
})

export type Constants = z.infer<typeof ConstantsWithScoringSchema>
export type ScoringTuning = Constants['scoring']
export type MissionTuning = Constants['mission']
export type PerCrewPerDay = Constants['perCrewPerDay']
export type TeamRules = Constants['teamRules']
