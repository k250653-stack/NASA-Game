/**
 * Launch Check: go / no-go review of a design. Each Check carries a plain-English explanation
 * with the actual numbers. Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import { computeMargins, computeTotals, resolveDesign, rocketCapacityKg } from './budget'
import { effectiveBudgetM } from './difficulty'
import { fmt, fmtPct } from './format'
import { batteryMarginRatio, batteryNeededWh, daysOfSupply } from './physics'
import { supplyFeasibilityCheck } from './supplyFeasibility'
import { totalMissionDays } from './timeline'
import type { Check, Design, EngineContent } from './types'

/** True when nothing failed. Warnings do not block launch. */
export function canLaunch(checks: readonly Check[]): boolean {
  return checks.every((c) => c.status !== 'fail')
}

export function runLaunchCheck(design: Design, content: EngineContent): Check[] {
  const { destination, scenario, rocket, crew } = resolveDesign(design, content)
  const C = content.constants
  const t = computeTotals(design, content)
  const budgetM = effectiveBudgetM(scenario, design.difficulty, content)
  const margins = computeMargins(t, rocket, scenario, destination, budgetM / scenario.budgetM)
  const checks: Check[] = []

  // 1. Mass vs rocket capacity to this destination.
  const capacity = rocketCapacityKg(rocket, destination)
  const massTarget = C.massMarginTarget.value
  if (!rocket) {
    checks.push({
      id: 'mass',
      label: 'Mass',
      status: 'fail',
      value: t.massKg,
      limit: 0,
      unit: 'kg',
      explanation: `No launcher selected: the ${fmt(t.massKg)} kg payload has no ride to ${destination.name}.`,
    })
  } else if (capacity <= 0) {
    checks.push({
      id: 'mass',
      label: 'Mass',
      status: 'fail',
      value: t.massKg,
      limit: 0,
      unit: 'kg',
      explanation: `The ${rocket.name} cannot reach ${destination.name}. Pick a launcher rated for it.`,
    })
  } else {
    const over = t.massKg - capacity
    checks.push({
      id: 'mass',
      label: 'Mass',
      status: over > 0 ? 'fail' : margins.mass < massTarget ? 'warn' : 'ok',
      value: t.massKg,
      limit: capacity,
      unit: 'kg',
      explanation:
        over > 0
          ? `Total mass ${fmt(t.massKg)} kg exceeds the ${rocket.name}'s ${fmt(capacity)} kg to ${destination.name} by ${fmt(over)} kg.`
          : `Total mass ${fmt(t.massKg)} kg fits the ${rocket.name}'s ${fmt(capacity)} kg with ${fmt(-over)} kg (${fmtPct(margins.mass)}) to spare` +
            (margins.mass < massTarget ? `, below the ${fmtPct(massTarget)} safety margin.` : '.'),
    })
  }

  // 2. Budget.
  const overBudget = t.costM - budgetM
  checks.push({
    id: 'budget',
    label: 'Budget',
    status: overBudget > 0 ? 'fail' : 'ok',
    value: t.costM,
    limit: budgetM,
    unit: '$M',
    explanation:
      overBudget > 0
        ? `Total cost $${fmt(t.costM, 1)}M is $${fmt(overBudget, 1)}M over the $${fmt(budgetM)}M budget.`
        : `Total cost $${fmt(t.costM, 1)}M leaves $${fmt(-overBudget, 1)}M of the $${fmt(budgetM)}M budget.`,
  })

  // 3. Power margin.
  const powerTarget = C.powerMarginTarget.value
  checks.push({
    id: 'power',
    label: 'Power',
    status: margins.power < 0 ? 'fail' : margins.power < powerTarget ? 'warn' : 'ok',
    value: t.powerGenW,
    limit: t.powerUseW,
    unit: 'W',
    explanation:
      margins.power < 0
        ? `Systems draw ${fmt(t.powerUseW)} W but power sources average only ${fmt(t.powerGenW)} W, a ${fmt(t.powerUseW - t.powerGenW)} W shortfall.`
        : `Power sources average ${fmt(t.powerGenW)} W against a ${fmt(t.powerUseW)} W load: ${fmtPct(margins.power)} margin` +
          (margins.power < powerTarget ? `, below the ${fmtPct(powerTarget)} target.` : '.'),
  })

  // 4. Battery through the longest dark period (steady sources keep working in the dark).
  const darkLoadW = Math.max(0, t.powerUseW - t.steadyGenW)
  const neededWh = batteryNeededWh(darkLoadW, destination.darkPeriodHours)
  const batteryOk = batteryMarginRatio(t.batteryWh, neededWh) >= 1
  checks.push({
    id: 'battery',
    label: 'Night survival',
    status: batteryOk ? 'ok' : 'fail',
    value: t.batteryWh,
    limit: neededWh,
    unit: 'Wh',
    explanation:
      neededWh === 0
        ? `Steady power covers the whole ${fmt(t.powerUseW)} W load, so no battery is needed for the ${fmt(destination.darkPeriodHours)}-hour dark period.`
        : `Getting through ${fmt(destination.darkPeriodHours)} hours of darkness at ${fmt(darkLoadW)} W needs ${fmt(neededWh)} Wh; batteries hold ${fmt(t.batteryWh)} Wh` +
          (batteryOk ? '.' : `, ${fmt(neededWh - t.batteryWh)} Wh short.`),
  })

  // 5. Supplies for the whole mission (all phases) + reserve.
  const missionDays = totalMissionDays(destination)
  const supply = daysOfSupply(
    design.supplies,
    t.crewCount,
    C.perCrewPerDay,
    t.waterRecoveryRate,
    t.oxygenRecoveryRate,
  )
  const reserve = C.reserveDaysRequired.value
  const required = missionDays + reserve
  checks.push({
    id: 'supplies',
    label: 'Supplies',
    status: supply.days < missionDays ? 'fail' : supply.days < required ? 'warn' : 'ok',
    value: supply.days,
    limit: required,
    unit: 'days',
    explanation:
      t.crewCount === 0
        ? 'No crew on board, so supplies are not consumed.'
        : `Supplies last ${fmt(supply.days, 1)} days (${supply.limiting} runs out first); the mission needs ${fmt(missionDays)} days plus a ${fmt(reserve)}-day reserve = ${fmt(required)} days.`,
  })

  // 6. EVA suits.
  const evaCrew = crew.filter((c) => c.skills.systems >= C.evaMinSystemsSkill.value).length
  checks.push({
    id: 'suits',
    label: 'EVA suits',
    status: evaCrew > 0 && t.suitCount < 1 ? 'fail' : 'ok',
    value: t.suitCount,
    limit: evaCrew > 0 ? 1 : 0,
    unit: 'suits',
    explanation:
      evaCrew === 0
        ? 'No EVA-capable crew on board, so no suits are required.'
        : t.suitCount < 1
          ? `${fmt(evaCrew)} crew are trained for surface work but there are no EVA suits on board.`
          : `${fmt(t.suitCount)} EVA suit(s) for ${fmt(evaCrew)} EVA-capable crew.`,
  })

  // 7. Data return vs data generated.
  const warnRatio = C.dataReturnWarnRatio.value
  const returnedShare =
    t.dataGenGbPerDay > 0 ? Math.min(1, t.dataReturnGbPerDay / t.dataGenGbPerDay) : 1
  checks.push({
    id: 'data',
    label: 'Data return',
    status: returnedShare < warnRatio ? 'warn' : 'ok',
    value: t.dataReturnGbPerDay,
    limit: t.dataGenGbPerDay,
    unit: 'GB/day',
    explanation:
      t.dataGenGbPerDay === 0
        ? 'No instruments produce data, so no downlink is needed.'
        : `Instruments produce ${fmt(t.dataGenGbPerDay, 1)} GB/day and the links can send ${fmt(t.dataReturnGbPerDay, 1)} GB/day in ${fmt(destination.contactHoursPerDay)} contact hours: ${fmtPct(returnedShare)} gets home.`,
  })

  // 8. Crew count matches scenario.
  checks.push({
    id: 'crew-count',
    label: 'Crew size',
    status: t.crewCount === scenario.crewSize ? 'ok' : 'fail',
    value: t.crewCount,
    limit: scenario.crewSize,
    unit: 'crew',
    explanation:
      t.crewCount === scenario.crewSize
        ? `${fmt(t.crewCount)} crew recruited, as ${scenario.name} requires.`
        : `${scenario.name} needs exactly ${fmt(scenario.crewSize)} crew; ${fmt(t.crewCount)} recruited.`,
  })

  // 9. Habitat space.
  checks.push({
    id: 'habitat',
    label: 'Habitat',
    status: t.crewCapacity >= t.crewCount ? 'ok' : 'fail',
    value: t.crewCapacity,
    limit: t.crewCount,
    unit: 'crew',
    explanation:
      t.crewCapacity >= t.crewCount
        ? `Habitats house ${fmt(t.crewCapacity)} crew; ${fmt(t.crewCount)} on board.`
        : `Habitats only house ${fmt(t.crewCapacity)} crew but ${fmt(t.crewCount)} are on board.`,
  })

  // 10. Could the rocket even carry everything this mission needs?
  // Uses mission days (no reserve): "can you even pack enough for the trip?"
  checks.push(
    supplyFeasibilityCheck(t, missionDays, C.perCrewPerDay, capacity, rocket?.name ?? null),
  )

  return checks
}
