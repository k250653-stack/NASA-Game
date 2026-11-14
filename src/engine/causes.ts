/**
 * Cause chains for the Failure Review Board: "X happened because Y because Z".
 * Pure TypeScript. No React, no store (CLAUDE.md rule 1).
 */
import type { MissionState } from './mission'

export interface CauseLink {
  /** Short statement, e.g. "Battery hit 0% on day 12". */
  effect: string
  /** What led to it, e.g. "Solar array lost 30% output to dust". */
  cause: string
  /** Design decision the player can change, e.g. "Add a second battery". */
  fix: string
  /** Lesson id to open from this link, if any. */
  lessonId?: string
}

const notImplemented = (name: string): never => {
  throw new Error(`engine/causes.${name} is not implemented yet`)
}

/** Walks the mission log backwards and builds the chain that led to failure or shortfall. */
export function buildCauseChain(_state: MissionState): CauseLink[] {
  return notImplemented('buildCauseChain')
}
