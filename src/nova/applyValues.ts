/**
 * Numbers for a lesson's "Apply to your mission" line, from the engine and the player's actual
 * design (and the running mission, if any). Fills {placeholders} in lessons.json applyTemplate.
 */
import { computeMargins, computeTotals, resolveDesign } from '@/engine/budget'
import { runLaunchCheck } from '@/engine/launchCheck'
import { daysOfSupply } from '@/engine/physics'
import { signalDelay } from '@/engine/timeline'
import type { Design, EngineContent, MissionState } from '@/engine/types'

export type ApplyValues = Record<string, string>

const n = (v: number, digits = 0) =>
  Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: digits }) : '∞'
const pct = (v: number) => `${Math.round(v * 100)}%`

/** Every placeholder a lesson may use, formatted for reading. */
export function applyValues(
  design: Design,
  content: EngineContent,
  run: MissionState | null,
): ApplyValues {
  const { scenario, destination, rocket } = resolveDesign(design, content)
  const t = computeTotals(design, content)
  const multiplier = content.constants.difficulty[design.difficulty].budgetMultiplier
  const m = computeMargins(t, rocket, scenario, destination, multiplier)
  const capacity = rocket?.capacityKgByDestination[destination.id] ?? 0
  const per = content.constants.perCrewPerDay
  const supply = daysOfSupply(
    design.supplies,
    t.crewCount,
    per,
    t.waterRecoveryRate,
    t.oxygenRecoveryRate,
  )
  const nightNeed = Math.max(0, t.powerUseW - t.steadyGenW) * destination.darkPeriodHours
  const checks = runLaunchCheck(design, content)
  const delaySec = run ? signalDelay(destination, run.day) : destination.signalDelaySec
  return {
    destinationName: destination.name,
    rocketName: rocket?.name ?? 'no rocket',
    totalMassKg: n(t.massKg),
    capacityKg: n(capacity),
    marginPct: pct(m.mass),
    rocketCostM: n(rocket?.costM ?? 0),
    budgetM: n(scenario.budgetM * multiplier),
    reliabilityPct: pct(rocket?.reliability ?? 0),
    powerGenW: n(t.powerGenW),
    powerUseW: n(t.powerUseW),
    batteryWh: n(t.batteryWh),
    darkHours: n(destination.darkPeriodHours),
    nightNeedWh: n(nightNeed),
    crewCount: n(t.crewCount),
    oxygenPerDay: n(t.crewCount * per.oxygenKg, 1),
    waterPerDay: n(t.crewCount * per.waterKg, 1),
    foodPerDay: n(t.crewCount * per.foodKg, 1),
    supplyDays: n(supply.days),
    dataGenGbPerDay: n(t.dataGenGbPerDay, 1),
    dataReturnGbPerDay: n(t.dataReturnGbPerDay, 1),
    contactHours: n(destination.contactHoursPerDay),
    dataReturnPct: pct(
      t.dataGenGbPerDay > 0 ? Math.min(1, t.dataReturnGbPerDay / t.dataGenGbPerDay) : 1,
    ),
    solarRatedW: n(t.solarRatedW),
    dustNowPct: pct(run?.dustLevel ?? 0),
    delayMin: n(delaySec / 60, 1),
    okCount: n(checks.filter((c) => c.status === 'ok').length),
    warnCount: n(checks.filter((c) => c.status === 'warn').length),
    failCount: n(checks.filter((c) => c.status === 'fail').length),
  }
}

/** "{a} and {b}" -> values; unknown placeholders stay visible so a typo is easy to spot. */
export function fillTemplate(template: string, values: ApplyValues): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all)
}

/** Live numbers the visuals start from (raw numbers, not formatted). */
export interface VizLive {
  capacityKg?: number
  massKg?: number
  loadW?: number
  solarW?: number
  batteryWh?: number
  darkHours?: number
  crew?: number
  days?: number
  waterRecycle?: number
  oxygenRecycle?: number
  dataGbPerDay?: number
  returnGbPerDay?: number
  contactHours?: number
  delayMin?: number
}

export function vizLive(design: Design, content: EngineContent, run: MissionState | null): VizLive {
  const { destination, rocket, scenario } = resolveDesign(design, content)
  const t = computeTotals(design, content)
  return {
    capacityKg: rocket?.capacityKgByDestination[destination.id],
    massKg: t.massKg,
    loadW: t.powerUseW,
    solarW: t.solarRatedW * destination.sunlightFactor,
    batteryWh: t.batteryWh,
    darkHours: destination.darkPeriodHours,
    crew: t.crewCount,
    days: scenario.durationDays,
    waterRecycle: t.waterRecoveryRate,
    oxygenRecycle: t.oxygenRecoveryRate,
    dataGbPerDay: t.dataGenGbPerDay,
    returnGbPerDay: t.dataReturnGbPerDay,
    contactHours: destination.contactHoursPerDay,
    delayMin: (run ? signalDelay(destination, run.day) : destination.signalDelaySec) / 60,
  }
}
