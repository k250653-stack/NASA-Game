/**
 * Walkable-world state: which door the player went through (so finishing that screen returns to
 * the lobby in front of it), the fade-to-black overlay, and progress the game store doesn't keep.
 * Read with selectors only: useWorld((s) => s.fade).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useStore, type Phase } from '@/store'
import type { DoorTarget } from './rooms/room'

/** Screen a door opens, and the screens that still count as "inside" that door. */
export const DOOR_VISITS: Record<DoorTarget, { entry: Phase; phases: readonly Phase[] }> = {
  planning: { entry: 'destination', phases: ['destination', 'scenario'] },
  personnel: { entry: 'role', phases: ['role', 'recruit'] },
  briefing: { entry: 'planning', phases: ['planning'] },
  // After launch the mission plays on; leaving those screens returns to the lobby.
  launch: { entry: 'launch', phases: ['launch', 'mission', 'review', 'codex'] },
}

const FADE_MS = 300

interface Visit {
  doorId: string
  target: DoorTarget
}

interface WorldState {
  visit: Visit | null
  /** Door to stand in front of when the lobby opens (null = centre of the floor). */
  spawnDoorId: string | null
  /** The player finished the Briefing (Planning Board) with Next. Unlocks Launch Control. */
  planningDone: boolean
  /** Black overlay opacity and how long the change to it takes. */
  fade: { opacity: number; ms: number }
  resetWorld: () => void
}

const initial = {
  visit: null,
  spawnDoorId: null,
  planningDone: false,
  fade: { opacity: 0, ms: 0 },
}

export const useWorld = create<WorldState>()(
  persist(
    (set) => ({
      ...initial,
      resetWorld: () => set(initial),
    }),
    {
      name: 'mission-control-world',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        visit: s.visit,
        spawnDoorId: s.spawnDoorId,
        planningDone: s.planningDone,
      }),
    },
  ),
)

/** Fade to black, open the door's screen, fade back in. */
export function enterDoor(doorId: string, target: DoorTarget): void {
  useWorld.setState({ visit: { doorId, target }, fade: { opacity: 1, ms: FADE_MS } })
  window.setTimeout(() => {
    useStore.getState().setPhase(DOOR_VISITS[target].entry)
    useWorld.setState({ fade: { opacity: 0, ms: FADE_MS } })
  }, FADE_MS)
}

/** Back to the lobby in front of `doorId`, fading in from black. */
function returnToLobby(doorId: string): void {
  useWorld.setState({ visit: null, spawnDoorId: doorId, fade: { opacity: 1, ms: 0 } })
  useStore.getState().setPhase('hq')
  window.setTimeout(() => useWorld.setState({ fade: { opacity: 0, ms: FADE_MS } }), 30)
}

// Leaving a door's screens (Next past the last one, Back past the first) returns to the lobby.
useStore.subscribe((s, prev) => {
  const phase = s.game.phase
  if (phase === prev.game.phase || phase === 'hq') return
  const { visit } = useWorld.getState()
  if (!visit || DOOR_VISITS[visit.target].phases.includes(phase)) return
  if (visit.target === 'briefing' && phase === 'launch') useWorld.setState({ planningDone: true })
  returnToLobby(visit.doorId)
})
