/**
 * Mass / power / money totals and margins for a mission design.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import type { CrewMember, Destination, Part, Rocket, Scenario } from '@/schemas'

export interface BudgetSummary {
  massKg: number
  massCapacityKg: number
  massMarginKg: number
  powerBalanceW: number
  costM: number
  budgetM: number
  costMarginM: number
}

const notImplemented = (name: string): never => {
  throw new Error(`engine/budget.${name} is not implemented yet`)
}

/** Computes every total and margin the Planning Board and Launch Check display. */
export function summarizeBudget(_input: {
  scenario: Scenario
  destination: Destination
  parts: readonly Part[]
  rocket: Rocket | null
  crew: readonly CrewMember[]
}): BudgetSummary {
  return notImplemented('summarizeBudget')
}

/** Total cost in millions USD: parts + rocket + crew salaries. */
export function totalCostM(
  _parts: readonly Part[],
  _rocket: Rocket | null,
  _crew: readonly CrewMember[],
): number {
  return notImplemented('totalCostM')
}
