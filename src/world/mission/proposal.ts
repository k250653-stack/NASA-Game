/**
 * A teammate's proposal for an event in their role: who owns it, what they would do, with whom
 * and why (engine crewAI). The player approves it or overrides it. No React.
 */
import { chooseResponse, eventOwner, type AiDecision } from '@/engine/crewAI'
import { crewMembers } from '@/engine/missionHelpers'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { CrewMember, GameEvent } from '@/schemas'

export interface Proposal {
  owner: CrewMember
  decision: AiDecision
  optionLabel: string
  /** Who would do it (null when the option needs nobody). */
  actor: CrewMember | null
}

/** True when the event is the player's own call (their role, or the Mission Director). */
export function isOwnEvent(event: GameEvent, design: Design): boolean {
  return design.playerRole === null || design.playerRole === event.role
}

export function teammateProposal(
  run: MissionState,
  event: GameEvent,
  design: Design,
  content: EngineContent,
): Proposal | null {
  const ctx = { design, content }
  const crew = crewMembers(ctx).filter((m) => !m.isPlayer)
  const owner = eventOwner(run, event, crew)
  if (!owner) return null
  const decision = chooseResponse(run, event, crew, owner.priorities, design.standingOrders, ctx)
  if (!decision) return null
  const option = event.options.find((o) => o.id === decision.optionId)
  return {
    owner,
    decision,
    optionLabel: option?.label ?? decision.optionId,
    actor: crewMembers(ctx).find((m) => m.id === decision.crewId) ?? null,
  }
}

export interface DecisionCounts {
  /** Your own events, decided by you. */
  decided: number
  /** Teammate proposals you approved. */
  approved: number
  /** Teammate events where you chose instead. */
  overridden: number
  /** Answered under standing orders (signal delay). */
  standingOrders: number
}

/** Who decided what, from the mission's decision records (for the debrief). */
export function decisionCounts(
  run: MissionState,
  design: Design,
  content: EngineContent,
): DecisionCounts {
  const counts: DecisionCounts = { decided: 0, approved: 0, overridden: 0, standingOrders: 0 }
  for (const d of run.decisions) {
    const event = content.events.find((e) => e.id === d.eventId)
    if (d.handledBy === 'standing-orders') counts.standingOrders++
    else if (d.handledBy === 'ai') counts.approved++
    else if (event && isOwnEvent(event, design)) counts.decided++
    else counts.overridden++
  }
  return counts
}
