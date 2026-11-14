import type { Difficulty, RoleChoice } from '@/schemas'
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
/** 'styleguide' is a dev-only screen outside the game flow; Next/Back from it go to the title. */
export type Phase = (typeof PHASES)[number] | 'styleguide'

/** Fixed seed used by the "demo run" button so the judged run is always the same. */
export const DEMO_SEED = 20261114

/** Clock-made seeds are 0 to 99,999 so they are short enough to type back in. */
export const SEED_RANGE = 100000

export interface GameState {
  phase: Phase
  destinationId: string | null
  scenarioId: string | null
  /** Chosen seat (four roles or the sandbox Mission Director). */
  roleChoice: RoleChoice | null
  difficulty: Difficulty
  /** Player callsign; empty means "You". */
  callsign: string
  seed: number
  /** Concepts the player has met (see store/concepts.ts). */
  conceptsSeen: string[]
}

export interface GameSlice {
  game: GameState
  setPhase: (phase: Phase) => void
  nextPhase: () => void
  prevPhase: () => void
  setDestination: (destinationId: string | null) => void
  setScenario: (scenarioId: string | null) => void
  setRoleChoice: (role: RoleChoice | null) => void
  setDifficulty: (difficulty: Difficulty) => void
  setCallsign: (callsign: string) => void
  setSeed: (seed: number) => void
  /** New seed from the clock (seed creation only; all game randomness uses the seeded Rng). */
  rollSeed: () => void
  resetGame: () => void
}

export const initialGameState: GameState = {
  phase: 'title',
  destinationId: null,
  scenarioId: null,
  roleChoice: null,
  difficulty: 'engineer',
  callsign: '',
  seed: DEMO_SEED,
  conceptsSeen: [],
}

/** Position in the game flow, or -1 for screens outside it (styleguide). */
export function phaseIndex(phase: Phase): number {
  return (PHASES as readonly Phase[]).indexOf(phase)
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
  setRoleChoice: (roleChoice) => set((s) => ({ game: { ...s.game, roleChoice } })),
  setDifficulty: (difficulty) => set((s) => ({ game: { ...s.game, difficulty } })),
  setCallsign: (callsign) => set((s) => ({ game: { ...s.game, callsign } })),
  setSeed: (seed) => set((s) => ({ game: { ...s.game, seed } })),
  rollSeed: () => set((s) => ({ game: { ...s.game, seed: Date.now() % SEED_RANGE } })),
  resetGame: () => set({ game: initialGameState }),
})
