/** Which HQ doors are open, following game progress. */
import { getContent } from '@/content/load'
import { validateTeam } from '@/engine/recruitment'
import { useStore } from '@/store'
import type { Door } from './rooms/room'
import { useWorld } from './worldStore'

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
 * Why the door is locked, or null when it opens. Order: Planning, then Personnel (scenario
 * chosen), Briefing (valid crew), Launch Control (plan finished).
 */
export function doorLockReason(door: Door): string | null {
  if (door.locked) return door.lockedReason ?? 'This door is not open yet.'
  const { game, mission } = useStore.getState()
  switch (door.target) {
    case 'planning':
      return null
    case 'personnel':
      return game.scenarioId ? null : 'Choose a destination and scenario in Mission Planning.'
    case 'briefing':
      return teamReady() ? null : 'Recruit a full crew in Personnel first.'
    case 'launch':
      return useWorld.getState().planningDone || mission.run !== null
        ? null
        : 'Finish the mission plan in Briefing first.'
  }
}
