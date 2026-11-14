/**
 * Autopilot: lets the AI answer the player's pending events too, so a whole mission can be
 * simulated without input (debug panel, tests, balance checks). Pure TypeScript.
 */
import { chooseResponse, eventOwner } from './crewAI'
import { resolveEvent } from './events'
import { advanceTurn, isMissionOver } from './mission'
import { crewMembers } from './missionHelpers'
import type { Rng } from './rng'
import type { Design, EngineContent, MissionState } from './types'

/** Answers every pending event with the AI's choice (the owner's priorities, standing orders). */
export function answerPendingWithAi(
  state: MissionState,
  design: Design,
  content: EngineContent,
  rng: Rng,
): MissionState {
  const ctx = { design, content }
  const crew = crewMembers(ctx)
  let s = state
  for (const p of [...s.pendingEvents]) {
    const event = content.events.find((e) => e.id === p.eventId)
    const owner = event ? eventOwner(s, event, crew) : null
    if (!event || !owner) continue
    const d = chooseResponse(s, event, crew, owner.priorities, design.standingOrders, ctx)
    if (d) s = resolveEvent(s, event, d.optionId, d.crewId, rng, ctx, 'player', 'Autopilot: ').state
  }
  return s
}

/** Runs the mission to the end, answering every event with the AI. */
export function autoRun(
  state: MissionState,
  design: Design,
  content: EngineContent,
  rng: Rng,
): MissionState {
  let s = answerPendingWithAi(state, design, content, rng)
  while (!isMissionOver(s)) {
    s = advanceTurn(s, design, content, rng).state
    s = answerPendingWithAi(s, design, content, rng)
  }
  return s
}
