import type { StateCreator } from 'zustand'
import type { GameSlice } from './gameSlice'
import type { DesignSlice } from './designSlice'
import type { CrewSlice } from './crewSlice'
import type { MissionSlice } from './missionSlice'

/** The whole store. Each slice owns one nested state object plus flat actions. */
export type RootState = GameSlice & DesignSlice & CrewSlice & MissionSlice

/** Helper type for writing a slice that lives inside the persisted root store. */
export type SliceCreator<T> = StateCreator<RootState, [['zustand/persist', unknown]], [], T>
