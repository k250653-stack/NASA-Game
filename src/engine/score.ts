/**
 * Weighted mission score.
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import type { MissionState } from './mission'
import type { Scenario } from '@/schemas'

export interface ScoreBreakdown {
  science: number
  safety: number
  cost: number
  /** 0-100 weighted total. */
  total: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

const notImplemented = (name: string): never => {
  throw new Error(`engine/score.${name} is not implemented yet`)
}

export function scoreMission(
  _state: MissionState,
  _scenario: Scenario,
  _costM: number,
): ScoreBreakdown {
  return notImplemented('scoreMission')
}
