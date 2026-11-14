/**
 * Physics helpers: solar power, batteries, data links, life support, orbits.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1). Every number comes in as a parameter;
 * nothing here knows which planet it is on.
 */
import type { PerCrewPerDay } from '@/schemas'

const SECONDS_PER_HOUR = 3600
/** Megabits -> gigabytes: 1 GB = 8,000 Mb (decimal units, as link budgets use). */
const MEGABITS_PER_GIGABYTE = 8000

/**
 * Average solar output on a given day.
 * Output = rated power × sunlight factor × share of time in light × (1 − dust loss per day)^day.
 * Dust compounds: each day keeps (1 − dustLossPerDay) of the previous day's output.
 */
export function solarOutputW(
  ratedW: number,
  sunlightFactor: number,
  lightFraction: number,
  dustLossPerDay: number,
  day: number,
): number {
  const dustRemaining = Math.pow(1 - dustLossPerDay, Math.max(0, day))
  return Math.max(0, ratedW * sunlightFactor * lightFraction * dustRemaining)
}

/**
 * Energy the batteries must hold to get through the longest dark period.
 * Needed Wh = load during darkness (W) × dark period (h).
 */
export function batteryNeededWh(loadW: number, darkPeriodHours: number): number {
  return Math.max(0, loadW) * Math.max(0, darkPeriodHours)
}

/**
 * How many times the battery covers the need. 1 = exactly enough, < 1 = runs flat.
 * Ratio = capacity Wh ÷ needed Wh. Nothing needed = Infinity (always enough).
 */
export function batteryMarginRatio(capacityWh: number, neededWh: number): number {
  if (neededWh <= 0) return Number.POSITIVE_INFINITY
  return capacityWh / neededWh
}

/**
 * Data a link can send home per day.
 * GB/day = rate (Mbps) × 3600 s/h × contact hours per day ÷ 8000 Mb per GB.
 */
export function dataReturnedGbPerDay(dataRateMbps: number, contactHoursPerDay: number): number {
  return (dataRateMbps * SECONDS_PER_HOUR * contactHoursPerDay) / MEGABITS_PER_GIGABYTE
}

export interface LifeSupportKg {
  oxygen: number
  food: number
  water: number
}

/**
 * Consumables needed for a crew over a number of days.
 * Each = crew × days × per-crew-per-day rate. Recycling only reduces water:
 * water = crew × days × water rate × (1 − recovery rate).
 */
export function lifeSupportNeedKg(
  crewCount: number,
  days: number,
  perCrewPerDay: PerCrewPerDay,
  waterRecoveryRate: number,
): LifeSupportKg {
  const crewDays = Math.max(0, crewCount) * Math.max(0, days)
  const recovery = Math.min(1, Math.max(0, waterRecoveryRate))
  return {
    oxygen: crewDays * perCrewPerDay.oxygenKg,
    food: crewDays * perCrewPerDay.foodKg,
    water: crewDays * perCrewPerDay.waterKg * (1 - recovery),
  }
}

export type Consumable = 'oxygen' | 'food' | 'water'

export interface DaysOfSupply {
  oxygen: number
  food: number
  water: number
  /** The consumable that runs out first. Ties go to oxygen, then food, then water. */
  limiting: Consumable
  /** Days until the limiting consumable runs out. */
  days: number
}

/**
 * How long packed supplies last.
 * Days for each = supply kg ÷ (crew × daily rate); water's daily rate is × (1 − recovery).
 * No crew, or a fully recycled consumable, lasts forever (Infinity).
 */
export function daysOfSupply(
  supplies: { oxygenKg: number; foodKg: number; waterKg: number },
  crewCount: number,
  perCrewPerDay: PerCrewPerDay,
  waterRecoveryRate: number,
): DaysOfSupply {
  const perDay = lifeSupportNeedKg(crewCount, 1, perCrewPerDay, waterRecoveryRate)
  const last = (kg: number, use: number) =>
    use > 0 ? Math.max(0, kg) / use : Number.POSITIVE_INFINITY
  const oxygen = last(supplies.oxygenKg, perDay.oxygen)
  const food = last(supplies.foodKg, perDay.food)
  const water = last(supplies.waterKg, perDay.water)
  const order: Array<[Consumable, number]> = [
    ['oxygen', oxygen],
    ['food', food],
    ['water', water],
  ]
  const [limiting, days] = order.reduce((min, cur) => (cur[1] < min[1] ? cur : min))
  return { oxygen, food, water, limiting, days }
}

/**
 * Period of a circular orbit, in minutes (Kepler's third law).
 * Semi-major axis a = body radius + altitude; T = 2π × √(a³ ÷ μ) seconds, ÷ 60 for minutes.
 * μ (km³/s²) is the body's gravitational parameter, e.g. Earth 398,600.
 */
export function orbitalPeriodMin(
  altitudeKm: number,
  bodyRadiusKm: number,
  muKm3s2: number,
): number {
  const a = bodyRadiusKm + altitudeKm
  return (2 * Math.PI * Math.sqrt((a * a * a) / muKm3s2)) / 60
}
