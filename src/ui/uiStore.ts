/**
 * UI-only state (toasts, sound toggle). Not saved, not game state.
 * Read with selectors only: useUi((s) => s.toasts).
 */
import { create } from 'zustand'
import { setMuted } from './sound'

export type ToastKind = 'info' | 'warning' | 'danger' | 'success'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

interface UiState {
  toasts: ToastItem[]
  soundOn: boolean
  pushToast: (toast: Omit<ToastItem, 'id'>) => number
  dismissToast: (id: number) => void
  setSoundOn: (on: boolean) => void
}

/** Toasts kept on screen at once; older ones are dropped. */
const MAX_TOASTS = 4
let nextToastId = 1

export const useUi = create<UiState>()((set) => ({
  toasts: [],
  soundOn: true,
  pushToast: (toast) => {
    const id = nextToastId++
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-MAX_TOASTS) }))
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSoundOn: (on) => {
    setMuted(!on)
    set({ soundOn: on })
  },
}))

/** Shorthand: toast.warning('Battery low', 'Below 20% before nightfall'). */
export const toast = {
  info: (title: string, message?: string) =>
    useUi.getState().pushToast({ kind: 'info', title, message }),
  warning: (title: string, message?: string) =>
    useUi.getState().pushToast({ kind: 'warning', title, message }),
  danger: (title: string, message?: string) =>
    useUi.getState().pushToast({ kind: 'danger', title, message }),
  success: (title: string, message?: string) =>
    useUi.getState().pushToast({ kind: 'success', title, message }),
}
