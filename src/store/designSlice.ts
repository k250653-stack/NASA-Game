import type { SliceCreator } from './types'

export interface DesignState {
  /** Ids of parts on the Planning Board. */
  partIds: string[]
  rocketId: string | null
}

export interface DesignSlice {
  design: DesignState
  addPart: (partId: string) => void
  removePart: (partId: string) => void
  togglePart: (partId: string) => void
  setRocket: (rocketId: string | null) => void
  resetDesign: () => void
}

export const initialDesignState: DesignState = {
  partIds: [],
  rocketId: null,
}

export const createDesignSlice: SliceCreator<DesignSlice> = (set) => ({
  design: initialDesignState,
  addPart: (partId) =>
    set((s) =>
      s.design.partIds.includes(partId)
        ? s
        : { design: { ...s.design, partIds: [...s.design.partIds, partId] } },
    ),
  removePart: (partId) =>
    set((s) => ({
      design: { ...s.design, partIds: s.design.partIds.filter((id) => id !== partId) },
    })),
  togglePart: (partId) =>
    set((s) => ({
      design: {
        ...s.design,
        partIds: s.design.partIds.includes(partId)
          ? s.design.partIds.filter((id) => id !== partId)
          : [...s.design.partIds, partId],
      },
    })),
  setRocket: (rocketId) => set((s) => ({ design: { ...s.design, rocketId } })),
  resetDesign: () => set({ design: initialDesignState }),
})
