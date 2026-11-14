/**
 * Event triggers, option resolution and outcomes.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import type { Rng } from './rng'
import type { Effects, GameEvent } from '@/schemas'

export interface EventOutcome {
  eventId: string
  optionIndex: number
  success: boolean
  effects: Effects
  explanation: string
}

const notImplemented = (name: string): never => {
  throw new Error(`engine/events.${name} is not implemented yet`)
}

/** Events eligible to fire on a given day at a destination, after rolling their chance. */
export function rollEvents(_input: {
  events: readonly GameEvent[]
  destinationId: string
  day: number
  activeConditions: ReadonlySet<string>
  rng: Rng
}): GameEvent[] {
  return notImplemented('rollEvents')
}

/** Resolves a chosen option: spends resources, rolls success, returns effects. */
export function resolveOption(
  _event: GameEvent,
  _optionIndex: number,
  _skillBonus: number,
  _rng: Rng,
): EventOutcome {
  return notImplemented('resolveOption')
}
