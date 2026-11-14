/**
 * Mission turn loop: each day drains resources, produces science, then rolls events.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import type { Rng } from './rng'
import type { CrewMember, Destination, GameEvent, Part, Scenario } from '@/schemas'

export interface MissionLogEntry {
  day: number
  kind: 'info' | 'warning' | 'alarm' | 'science'
  text: string
}

export interface MissionState {
  day: number
  /** Resource name -> current amount (e.g. powerWh, waterL, foodDays, sciencePoints). */
  resources: Record<string, number>
  log: MissionLogEntry[]
  pendingEvents: GameEvent[]
  ended: boolean
}

export interface MissionSetup {
  scenario: Scenario
  destination: Destination
  parts: readonly Part[]
  crew: readonly CrewMember[]
  events: readonly GameEvent[]
  rng: Rng
}

const notImplemented = (name: string): never => {
  throw new Error(`engine/mission.${name} is not implemented yet`)
}

/** Initial mission state on day 0, with resources derived from the design. */
export function createMission(_setup: MissionSetup): MissionState {
  return notImplemented('createMission')
}

/** Advances the mission by one day and returns the new state (never mutates the input). */
export function advanceDay(_state: MissionState, _setup: MissionSetup): MissionState {
  return notImplemented('advanceDay')
}
