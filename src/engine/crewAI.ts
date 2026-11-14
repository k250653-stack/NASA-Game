/**
 * Rule-based AI teammates: each non-player crew member proposes decisions and explains why.
 * Pure TypeScript. No React, no store, no LLM (CLAUDE.md rule 1).
 */
import type { Rng } from './rng'
import type { CrewMember, GameEvent, Part } from '@/schemas'

export interface CrewDecision {
  crewId: string
  /** What the teammate wants to do (e.g. option index of an event, or a part id). */
  choice: string
  /** Plain-language reasons shown to the player, derived from traits and priorities. */
  reasons: string[]
}

const notImplemented = (name: string): never => {
  throw new Error(`engine/crewAI.${name} is not implemented yet`)
}

/** Which event option a teammate would choose, with reasons. */
export function chooseEventOption(_crew: CrewMember, _event: GameEvent, _rng: Rng): CrewDecision {
  return notImplemented('chooseEventOption')
}

/** Which parts a teammate recommends for their role, with reasons. */
export function recommendParts(_crew: CrewMember, _available: readonly Part[]): CrewDecision {
  return notImplemented('recommendParts')
}
