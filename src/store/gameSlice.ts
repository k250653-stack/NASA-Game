import type { Role } from '@/schemas'
import type { SliceCreator } from './types'

/** Navigation is the phase. There is no router: App.tsx renders the screen for the phase. */
export const PHASES = [
  'title',
  'destination',
  'scenario',
  'role',
  'recruit',
  'planning',
  'launch',
  'mission',
  'review',
  'codex',
] as const
export type Phase = (typeof PHASES)[number]

/** Fixed seed used by the "demo run" button so the judged run is always the same. */
export const DEMO_SEED = 20261114

export interface GameState {
  phase: Phase
  destinationId: string | null
  scenarioId: string | null
  playerRole: Role | null
  seed: number
}

export interface GameSlice {
  game: GameState
  setPhase: (phase: Phase) => void
  nextPhase: () => void
  prevPhase: () => void
  setDestination: (destinationId: string | null) => void
  setScenario: (scenarioId: string | null) => void
  setPlayerRole: (role: Role | null) => void
  setSeed: (seed: number) => void
  resetGame: () => void
}

export const initialGameState: GameState = {
  phase: 'title',
  destinationId: null,
  scenarioId: null,
  playerRole: null,
  seed: DEMO_SEED,
}

export function phaseIndex(phase: Phase): number {
  return PHASES.indexOf(phase)
}

export const createGameSlice: SliceCreator<GameSlice> = (set, get) => ({
  game: initialGameState,
  setPhase: (phase) => set((s) => ({ game: { ...s.game, phase } })),
  nextPhase: () => {
    const i = phaseIndex(get().game.phase)
    const next = PHASES[Math.min(i + 1, PHASES.length - 1)] ?? 'title'
    set((s) => ({ game: { ...s.game, phase: next } }))
  },
  prevPhase: () => {
    const i = phaseIndex(get().game.phase)
    const prev = PHASES[Math.max(i - 1, 0)] ?? 'title'
    set((s) => ({ game: { ...s.game, phase: prev } }))
  },
  setDestination: (destinationId) => set((s) => ({ game: { ...s.game, destinationId } })),
  setScenario: (scenarioId) => set((s) => ({ game: { ...s.game, scenarioId } })),
  setPlayerRole: (playerRole) => set((s) => ({ game: { ...s.game, playerRole } })),
  setSeed: (seed) => set((s) => ({ game: { ...s.game, seed } })),
  resetGame: () => set({ game: initialGameState }),
})
