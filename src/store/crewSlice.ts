import type { SliceCreator } from './types'

export interface CrewState {
  /** Ids of crew members the player has recruited. */
  recruitedIds: string[]
}

export interface CrewSlice {
  crew: CrewState
  recruit: (crewId: string) => void
  dismiss: (crewId: string) => void
  /** Replace the whole team (e.g. "Suggested team" or a role swap computed by the engine). */
  setRecruited: (crewIds: string[]) => void
  resetCrew: () => void
}

export const initialCrewState: CrewState = {
  recruitedIds: [],
}

export const createCrewSlice: SliceCreator<CrewSlice> = (set) => ({
  crew: initialCrewState,
  recruit: (crewId) =>
    set((s) =>
      s.crew.recruitedIds.includes(crewId)
        ? s
        : { crew: { ...s.crew, recruitedIds: [...s.crew.recruitedIds, crewId] } },
    ),
  dismiss: (crewId) =>
    set((s) => ({
      crew: { ...s.crew, recruitedIds: s.crew.recruitedIds.filter((id) => id !== crewId) },
    })),
  setRecruited: (recruitedIds) => set((s) => ({ crew: { ...s.crew, recruitedIds } })),
  resetCrew: () => set({ crew: initialCrewState }),
})
