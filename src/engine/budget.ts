/**
 * Mass / power / money / data totals and margins for a mission design.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import type { CrewMember, Destination, Part, PartStatKey, Rocket, Scenario } from '@/schemas'
import { dataReturnedGbPerDay, solarOutputW } from './physics'
import type { Design, EngineContent, Margins, Totals } from './types'

export interface ResolvedDesign {
  destination: Destination
  scenario: Scenario
  rocket: Rocket | null
  /** One entry per partId (repeats kept). */
  parts: Part[]
  crew: CrewMember[]
}

function byId<T extends { id: string }>(items: readonly T[], id: string, kind: string): T {
  const found = items.find((i) => i.id === id)
  if (!found) throw new Error(`Design references unknown ${kind} "${id}"`)
  return found
}

/** Turns the ids in a design into content objects. Throws on an unknown id. */
export function resolveDesign(design: Design, content: EngineContent): ResolvedDesign {
  return {
    destination: byId(content.destinations, design.destinationId, 'destination'),
    scenario: byId(content.scenarios, design.scenarioId, 'scenario'),
    rocket: design.rocketId === null ? null : byId(content.rockets, design.rocketId, 'rocket'),
    parts: design.partIds.map((id) => byId(content.parts, id, 'part')),
    crew: design.crewIds.map((id) => byId(content.crew, id, 'crew member')),
  }
}

function sum<T>(items: readonly T[], f: (item: T) => number): number {
  return items.reduce((acc, item) => acc + f(item), 0)
}

function sumStat(parts: readonly Part[], key: PartStatKey): number {
  return sum(parts, (p) => p.stats[key] ?? 0)
}

/** Highest value of a stat; recyclers do not stack, the best one sets the rate. */
function bestStat(parts: readonly Part[], key: PartStatKey): number {
  return parts.reduce((best, p) => Math.max(best, p.stats[key] ?? 0), 0)
}

/**
 * Totals over the whole design.
 * - mass = parts + supplies + crew × crewMassKg (body + gear)
 * - power generated = solar output on day 0 + steady sources (positive powerW)
 * - power used = sum of steady draws (negative powerW)
 * - cost = parts + rocket + crew salaries
 * - data returned = combined link rate over the destination's contact hours
 */
export function computeTotals(design: Design, content: EngineContent): Totals {
  const { destination, rocket, parts, crew } = resolveDesign(design, content)
  const { supplies } = design
  const partsMassKg = sum(parts, (p) => p.massKg)
  const suppliesKg = supplies.waterKg + supplies.foodKg + supplies.oxygenKg
  const crewMassKg = crew.length * content.constants.crewMassKg.value
  const solarRatedW = sumStat(parts, 'ratedPowerW')
  const steadyGenW = sum(parts, (p) => Math.max(0, p.powerW))
  const solarW = solarOutputW(
    solarRatedW,
    destination.sunlightFactor,
    destination.lightFraction,
    destination.dustLossPerDay,
    0,
  )

  return {
    massKg: partsMassKg + suppliesKg + crewMassKg,
    partsMassKg,
    suppliesKg,
    crewMassKg,
    powerGenW: solarW + steadyGenW,
    steadyGenW,
    solarRatedW,
    powerUseW: sum(parts, (p) => Math.max(0, -p.powerW)),
    costM: sum(parts, (p) => p.costM) + (rocket?.costM ?? 0) + sum(crew, (c) => c.salaryM),
    dataGenGbPerDay: sumStat(parts, 'scienceDataGbPerDay'),
    dataReturnGbPerDay: dataReturnedGbPerDay(
      sumStat(parts, 'dataRateMbps'),
      destination.contactHoursPerDay,
    ),
    sciencePerDay: sumStat(parts, 'sciencePointsPerDay'),
    batteryWh: sumStat(parts, 'capacityWh'),
    dataReturnTransitGbPerDay: dataReturnedGbPerDay(
      sumStat(parts, 'dataRateMbps'),
      destination.transitContactHoursPerDay,
    ),
    waterRecoveryRate: bestStat(parts, 'waterRecoveryRate'),
    oxygenRecoveryRate: bestStat(parts, 'oxygenRecoveryRate'),
    suitCount: sumStat(parts, 'suitCount'),
    spareKits: sumStat(parts, 'spareKits'),
    crewCapacity: sumStat(parts, 'crewCapacity'),
    storageKg: sumStat(parts, 'storageKg'),
    crewCount: crew.length,
  }
}

/**
 * Headroom ratio: (available − required) ÷ available.
 * Nothing available: −1 if something is required (fully short), else 0.
 */
export function marginRatio(available: number, required: number): number {
  if (available <= 0) return required > 0 ? -1 : 0
  return (available - required) / available
}

/** Rocket payload to this destination, kg. 0 if no rocket or it cannot reach it. */
export function rocketCapacityKg(rocket: Rocket | null, destination: Destination): number {
  return rocket?.capacityKgByDestination[destination.id] ?? 0
}

/** Mass, power, budget and data margins as ratios (see Margins). */
export function computeMargins(
  totals: Totals,
  rocket: Rocket | null,
  scenario: Scenario,
  destination: Destination,
  /** From the chosen difficulty (default 1). */
  budgetMultiplier = 1,
): Margins {
  return {
    mass: marginRatio(rocketCapacityKg(rocket, destination), totals.massKg),
    power: marginRatio(totals.powerGenW, totals.powerUseW),
    budget: marginRatio(scenario.budgetM * budgetMultiplier, totals.costM),
    data: marginRatio(totals.dataReturnGbPerDay, totals.dataGenGbPerDay),
  }
}
