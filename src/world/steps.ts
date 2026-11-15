/**
 * The four mission steps in the HQ: which screens a station opens, and when the lobby door
 * that leads to it unlocks.
 */
import { getContent } from '@/content/load'
import { validateTeam } from '@/engine/recruitment'
import { useStore, type Phase } from '@/store'
import type { Door, Step } from './rooms/room'

/** First screen a station opens, and the screens that still belong to that step. */
export const STEP_SCREENS: Record<Step, { entry: Phase; phases: readonly Phase[] }> = {
  planning: { entry: 'destination', phases: ['destination', 'scenario'] },
  personnel: { entry: 'role', phases: ['role', 'recruit'] },
  briefing: { entry: 'planning', phases: ['planning'] },
  launch: { entry: 'launch', phases: ['launch'] },
}

function teamReady(): boolean {
  const { game, crew } = useStore.getState()
  if (!game.scenarioId || !game.roleChoice) return false
  try {
    const draft = {
      scenarioId: game.scenarioId,
      difficulty: game.difficulty,
      roleChoice: game.roleChoice,
      crewIds: crew.recruitedIds,
    }
    return validateTeam(draft, getContent()).valid
  } catch {
    return false
  }
}

/**
 * Why the door is locked, or null when it opens. Gate order: Planning, then Personnel (scenario
 * chosen), Briefing (valid crew), Launch Control (plan finished).
 */
export function doorLockReason(door: Door, planningDone: boolean): string | null {
  if (door.locked) return door.lockedReason ?? 'This door is not open yet.'
  const { game, mission } = useStore.getState()
  switch (door.gate) {
    case undefined:
    case 'planning':
      return null
    case 'personnel':
      return game.scenarioId ? null : 'Choose a destination and scenario in Mission Planning.'
    case 'briefing':
      return teamReady() ? null : 'Recruit a full crew in Personnel first.'
    case 'launch':
      return planningDone || mission.run !== null
        ? null
        : 'Finish the mission plan in Briefing first.'
  }
}
