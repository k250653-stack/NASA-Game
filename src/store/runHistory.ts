/**
 * The last few finished runs (design, score, outcome) for the debrief's "Compared to last run".
 * Separate from the main save so starting a new game keeps the history. Read with selectors.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MissionScore } from '@/engine/score'
import type { Design } from '@/engine/types'

export const MAX_RUNS = 5

export interface RunEntry {
  /** Unique per finished mission (seed + design + how far it got), so a reload never adds twice. */
  id: string
  scenarioId: string
  destinationId: string
  seed: number
  design: Design
  score: MissionScore
  outcome: MissionScore['outcome']
  days: number
}

interface RunHistoryState {
  runs: RunEntry[]
  addRun: (run: RunEntry) => void
}

export const useRunHistory = create<RunHistoryState>()(
  persist(
    (set) => ({
      runs: [],
      addRun: (run) =>
        set((s) =>
          s.runs.some((r) => r.id === run.id) ? s : { runs: [...s.runs, run].slice(-MAX_RUNS) },
        ),
    }),
    {
      name: 'mission-control-runs',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ runs: s.runs }),
    },
  ),
)

/** The newest run, and the one before it for the same scenario (if any). */
export function latestRuns(runs: readonly RunEntry[]): { last?: RunEntry; previous?: RunEntry } {
  const last = runs[runs.length - 1]
  if (!last) return {}
  const previous = [...runs.slice(0, -1)].reverse().find((r) => r.scenarioId === last.scenarioId)
  return { last, previous }
}
