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
})

export type Constants = z.infer<typeof ConstantsSchema>
export type PerCrewPerDay = Constants['perCrewPerDay']
export type TeamRules = Constants['teamRules']
