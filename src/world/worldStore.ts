/**
 * Walkable-world state: the current room, where to stand on arrival, the open station popup,
 * the fade-to-black overlay, and progress the game store doesn't keep.
 * Read with selectors only: useWorld((s) => s.roomId).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useStore } from '@/store'
import { LOBBY_ID, type Door, type Step } from './rooms/room'
import { STEP_SCREENS } from './steps'

const FADE_MS = 300
/** Fade back in even if the next room never reports ready (e.g. a missing image). */
const FADE_TIMEOUT_MS = 2000

interface WorldState {
  roomId: string
  /** Door to stand in front of on arrival (null = centre of the floor). */
  spawnDoorId: string | null
  /** Step whose screens are open in the popup over the room. */
  popup: Step | null
  /** The player finished the Briefing (Planning Board) with Next. Unlocks Launch Control. */
  planningDone: boolean
  /** Black overlay opacity and how long the change to it takes. */
  fade: { opacity: number; ms: number }
  resetWorld: () => void
}

const initial = {
  roomId: LOBBY_ID,
  spawnDoorId: null,
  popup: null,
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
        roomId: s.roomId,
        spawnDoorId: s.spawnDoorId,
        popup: s.popup,
        planningDone: s.planningDone,
      }),
    },
  ),
)

let fadeTimer: number | undefined

/** Fade to black, switch room (the scene calls roomReady when drawn), fade back in. */
export function travel(door: Door): void {
  useWorld.setState({ fade: { opacity: 1, ms: FADE_MS } })
  window.setTimeout(() => {
    useWorld.setState({ roomId: door.to, spawnDoorId: door.arrive ?? null })
    fadeTimer = window.setTimeout(roomReady, FADE_TIMEOUT_MS)
  }, FADE_MS)
}

/** Called by the room scene once the room is drawn. */
export function roomReady(): void {
  window.clearTimeout(fadeTimer)
  if (useWorld.getState().fade.opacity > 0) useWorld.setState({ fade: { opacity: 0, ms: FADE_MS } })
}

/** Opens a station's screens in the popup over the room. */
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
