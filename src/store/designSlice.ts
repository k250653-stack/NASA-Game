import type { Supplies } from '@/engine/types'
import type { StandingOrders } from '@/schemas'
import type { SliceCreator } from './types'

export interface DesignState {
  /** Ids of parts on the Planning Board (repeats = several units). */
  partIds: string[]
  rocketId: string | null
  supplies: Supplies
  /** null until the first proposal; then the player's choices (Mars). */
  standingOrders: StandingOrders | null
  /** The inputs the current proposal was built for; when they change, the board re-proposes. */
  signature: string | null
  /** Negotiation outcomes, for the teamwork score. */
  tradesAccepted: number
  tradesRefused: number
}

export interface PlanningDesign {
  partIds: string[]
  rocketId: string | null
  supplies: Supplies
  standingOrders: StandingOrders
}

export interface DesignSlice {
  design: DesignState
  addPart: (partId: string) => void
  removePart: (partId: string) => void
  togglePart: (partId: string) => void
  setRocket: (rocketId: string | null) => void
  /** Replaces the editable design (the engine computed it). Pass a signature for a new proposal. */
  setPlanningDesign: (d: PlanningDesign, signature?: string) => void
  setStandingOrders: (orders: StandingOrders) => void
  recordTrade: (accepted: boolean) => void
  resetDesign: () => void
}

export const initialDesignState: DesignState = {
  partIds: [],
  rocketId: null,
  supplies: { waterKg: 0, foodKg: 0, oxygenKg: 0 },
  standingOrders: null,
  signature: null,
  tradesAccepted: 0,
  tradesRefused: 0,
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
  setPlanningDesign: (d, signature) =>
    set((s) => ({
      design: {
        ...s.design,
        ...d,
        ...(signature !== undefined ? { signature, tradesAccepted: 0, tradesRefused: 0 } : {}),
      },
    })),
  setStandingOrders: (standingOrders) => set((s) => ({ design: { ...s.design, standingOrders } })),
  recordTrade: (accepted) =>
    set((s) => ({
      design: {
        ...s.design,
        tradesAccepted: s.design.tradesAccepted + (accepted ? 1 : 0),
        tradesRefused: s.design.tradesRefused + (accepted ? 0 : 1),
      },
    })),
  resetDesign: () => set({ design: initialDesignState }),
})
