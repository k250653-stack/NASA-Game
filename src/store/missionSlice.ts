import type { MissionLogEntry } from '@/engine/mission'
import type { MissionState as EngineMissionState } from '@/engine/types'
import type { SliceCreator } from './types'

export interface MissionState {
  day: number
  /** Resource name -> amount, e.g. { powerWh: 18000, sciencePoints: 12 }. */
  resources: Record<string, number>
  log: MissionLogEntry[]
  /** The engine mission state, created by initMission at lift-off. */
  run: EngineMissionState | null
}

export interface MissionSlice {
  mission: MissionState
  setDay: (day: number) => void
  setResources: (resources: Record<string, number>) => void
  adjustResource: (name: string, delta: number) => void
  appendLog: (entry: MissionLogEntry) => void
  /** Stores the engine state (lift-off, then every turn). */
  setRun: (run: EngineMissionState | null) => void
  resetMission: () => void
}

export const initialMissionState: MissionState = {
  day: 0,
  resources: {},
  log: [],
  run: null,
}

export const createMissionSlice: SliceCreator<MissionSlice> = (set) => ({
  mission: initialMissionState,
  setDay: (day) => set((s) => ({ mission: { ...s.mission, day } })),
  setResources: (resources) => set((s) => ({ mission: { ...s.mission, resources } })),
  adjustResource: (name, delta) =>
    set((s) => ({
      mission: {
        ...s.mission,
        resources: { ...s.mission.resources, [name]: (s.mission.resources[name] ?? 0) + delta },
      },
    })),
  appendLog: (entry) => set((s) => ({ mission: { ...s.mission, log: [...s.mission.log, entry] } })),
  setRun: (run) => set((s) => ({ mission: { ...s.mission, run } })),
  resetMission: () => set({ mission: initialMissionState }),
})
