/** Shared engine types. Pure data, no behaviour. */
import type { GameContent } from '@/content/load'

/** Consumables packed for the mission, kg. */
export interface Supplies {
  waterKg: number
  foodKg: number
  oxygenKg: number
}

/** Everything the player decides before launch. Ids refer to content JSON. */
export interface Design {
  destinationId: string
  scenarioId: string
  /** null until the player picks a launcher. */
  rocketId: string | null
  /** May repeat an id to fly several units (e.g. two battery packs). */
  partIds: string[]
  supplies: Supplies
  crewIds: string[]
}

export type CheckStatus = 'ok' | 'warn' | 'fail'

export type CheckId =
  'mass' | 'budget' | 'power' | 'battery' | 'supplies' | 'suits' | 'data' | 'crew-count' | 'habitat'

/** One line of the Launch Check. */
export interface Check {
  id: CheckId
  label: string
  status: CheckStatus
  /** What the design has. */
  value: number
  /** What it is compared against. */
  limit: number
  unit: string
  /** Plain-English sentence with the numbers, shown to the player. */
  explanation: string
}

/** Sums over the design, computed by budget.computeTotals. */
export interface Totals {
  /** Parts + supplies + crew (with gear). */
  massKg: number
  partsMassKg: number
  suppliesKg: number
  crewMassKg: number
  /** Average generation on day 0: solar (sun, light share, dust) + steady sources. */
  powerGenW: number
  /** Steady generation that works in the dark (e.g. fission). */
  steadyGenW: number
  solarRatedW: number
  powerUseW: number
  /** Parts + rocket + crew salaries, millions USD. */
  costM: number
  dataGenGbPerDay: number
  /** Downlink capacity per day. */
  dataReturnGbPerDay: number
  sciencePerDay: number
  batteryWh: number
  /** Best recycler on board, 0-1. */
  waterRecoveryRate: number
  suitCount: number
  spareKits: number
  crewCapacity: number
  storageKg: number
  crewCount: number
}

/**
 * Margins as ratios: (available - required) / available.
 * 0 = exactly at the limit, negative = over the limit, 0.2 = 20% headroom.
 */
export interface Margins {
  mass: number
  power: number
  budget: number
  data: number
}

/** Content the engine reads. Same shape as the validated game content. */
export type EngineContent = Pick<
  GameContent,
  'constants' | 'destinations' | 'scenarios' | 'crew' | 'parts' | 'rockets'
>
