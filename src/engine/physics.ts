/**
 * Physics helpers: orbits, power, signal, mass, life support.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 *
 * Every function reads its numbers from content (Destination, Part, ...) — never `if (mars)`.
 */
import type { Destination, Part } from '@/schemas'

const notImplemented = (name: string): never => {
  throw new Error(`engine/physics.${name} is not implemented yet`)
}

/** Daily power balance in watt-hours for a set of parts at a destination. */
export function dailyPowerBalanceWh(_parts: readonly Part[], _destination: Destination): number {
  return notImplemented('dailyPowerBalanceWh')
}

/** One-way signal delay in seconds for a destination. */
export function signalDelaySec(_destination: Destination): number {
  return notImplemented('signalDelaySec')
}

/** Total payload mass in kilograms. */
export function totalMassKg(_parts: readonly Part[]): number {
  return notImplemented('totalMassKg')
}

/** Days of life support available for a crew of the given size. */
export function lifeSupportDays(_parts: readonly Part[], _crewSize: number): number {
  return notImplemented('lifeSupportDays')
}

/** Approximate one-way transit time in days (read from destination data). */
export function transitDays(_destination: Destination): number {
  return notImplemented('transitDays')
}
