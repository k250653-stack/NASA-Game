/**
 * The single Zustand store, combined from four slices and persisted to localStorage.
 *
 * Read state ONLY with selectors (CLAUDE.md rule 6):
 *   const phase = useStore((s) => s.game.phase)
 * Never `useStore()` with no selector.
 */
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createGameSlice, initialGameState } from './gameSlice'
import { createDesignSlice } from './designSlice'
import { createCrewSlice } from './crewSlice'
import { createMissionSlice } from './missionSlice'
import type { RootState } from './types'

export const SAVE_KEY = 'mission-control-save'

/** Only the data namespaces are saved; actions are re-created on load. */
type PersistedState = Pick<RootState, 'game' | 'design' | 'crew' | 'mission'>

/**
 * localStorage when available; an in-memory fallback otherwise (tests, private windows where
 * storage access throws). The game still runs, it just does not save.
 */
function safeStorage(): StateStorage {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) return localStorage
  } catch {
    // Access to localStorage can throw in locked-down browsers. Fall through.
  }
  const memory = new Map<string, string>()
  return {
    getItem: (name) => memory.get(name) ?? null,
    setItem: (name, value) => void memory.set(name, value),
    removeItem: (name) => void memory.delete(name),
  }
}

export const useStore = create<RootState>()(
  persist(
    (...a) => ({
      ...createGameSlice(...a),
      ...createDesignSlice(...a),
      ...createCrewSlice(...a),
      ...createMissionSlice(...a),
    }),
    {
      name: SAVE_KEY,
      version: 2,
      // Saves from older versions keep their choices; fields added since get their defaults.
      migrate: (persisted) => persisted as PersistedState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedState>
        return {
          ...current,
          game: { ...current.game, ...p.game },
          design: { ...current.design, ...p.design },
          crew: { ...current.crew, ...p.crew },
          mission: { ...current.mission, ...p.mission },
        }
      },
      storage: createJSONStorage(safeStorage),
      partialize: (s): PersistedState => ({
        game: s.game,
        design: s.design,
        crew: s.crew,
        mission: s.mission,
      }),
    },
  ),
)

/**
 * Picks a destination. A different destination invalidates everything chosen after it, so the
 * scenario, difficulty, role, crew, design and mission are cleared (the screen confirms first).
 */
export function changeDestination(destinationId: string): void {
  const s = useStore.getState()
  if (s.game.destinationId === destinationId) return
  useStore.setState((st) => ({
    game: {
      ...st.game,
      destinationId,
      scenarioId: null,
      roleChoice: null,
      difficulty: initialGameState.difficulty,
    },
  }))
  s.resetCrew()
  s.resetDesign()
  s.resetMission()
}

/** Picks a scenario and rolls a fresh seed for it. */
export function chooseScenario(scenarioId: string): void {
  const s = useStore.getState()
  if (s.game.scenarioId === scenarioId) return
  s.setScenario(scenarioId)
  s.rollSeed()
}

/** Wipes every slice back to its initial state (used by "New game"). */
export function resetAll(): void {
  const s = useStore.getState()
  s.resetGame()
  s.resetDesign()
  s.resetCrew()
  s.resetMission()
}

export type { RootState } from './types'
export { PHASES, DEMO_SEED, SEED_RANGE, phaseIndex } from './gameSlice'
export type { Phase, GameState } from './gameSlice'
export type { DesignState } from './designSlice'
export type { CrewState } from './crewSlice'
export type { MissionState } from './missionSlice'
