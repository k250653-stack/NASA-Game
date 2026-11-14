/**
 * Walkable-world state: the player's saved world position, the open station popup, and
 * progress the game store doesn't keep. Read with selectors only: useWorld((s) => s.popup).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useStore } from '@/store'
import type { Point } from './geometry'
import type { Step } from './rooms/room'
import { STEP_SCREENS } from './steps'

interface WorldState {
  /** Player feet in world pixels (null = centre of the lobby). */
  playerPos: Point | null
  /** Step whose screens are open in the popup over the HQ. */
  popup: Step | null
  /** The player finished the Briefing (Planning Board) with Next. Unlocks Launch Control. */
  planningDone: boolean
  resetWorld: () => void
}

const initial = { playerPos: null, popup: null, planningDone: false }

export const useWorld = create<WorldState>()(
  persist(
    (set) => ({
      ...initial,
      resetWorld: () => set(initial),
    }),
    {
      name: 'mission-control-world',
      version: 2,
      // v1 saved a current room instead of a world position; start those in the lobby.
      migrate: (persisted) => ({ ...initial, ...(persisted as object), playerPos: null }),
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        playerPos: s.playerPos,
        popup: s.popup,
        planningDone: s.planningDone,
      }),
    },
  ),
)

export function savePlayerPos(p: Point): void {
  useWorld.setState({ playerPos: [Math.round(p[0]), Math.round(p[1])] })
}

/** Opens a station's screens in the popup over the HQ. */
export function openStep(step: Step): void {
  useWorld.setState({ popup: step })
  useStore.getState().setPhase(STEP_SCREENS[step].entry)
}

/** Closes the popup (× / Esc, or the step finished) and returns to walking. */
export function closePopup(): void {
  useWorld.setState({ popup: null })
  useStore.getState().setPhase('hq')
}

// Leaving a step's screens (Next past the last one, Back past the first) closes the popup.
useStore.subscribe((s, prev) => {
  const phase = s.game.phase
  if (phase === prev.game.phase || phase === 'hq') return
  const { popup } = useWorld.getState()
  if (!popup || STEP_SCREENS[popup].phases.includes(phase)) return
  if (popup === 'briefing' && phase === 'launch') useWorld.setState({ planningDone: true })
  // Launching starts the mission: leave the world and play it full screen.
  if (popup === 'launch' && phase === 'mission') {
    useWorld.setState({ popup: null })
    return
  }
  closePopup()
})
