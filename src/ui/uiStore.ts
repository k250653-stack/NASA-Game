/**
 * UI-only state (toasts, sandbox start). Not saved, not game state.
 * Read with selectors only: useUi((s) => s.toasts).
 */
import { create } from 'zustand'

export type ToastKind = 'info' | 'warning' | 'danger' | 'success'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  message?: string
  /** Optional button, e.g. "View". */
  action?: { label: string; onClick: () => void }
}

interface UiState {
  toasts: ToastItem[]
  /** Set by the menu's Sandbox Mode; Role select then pre-picks the Mission Director. */
  sandboxStart: boolean
  setSandboxStart: (on: boolean) => void
  /** Planning Board panel to scroll to and focus on arrival ("Fix in Planning"). */
  focusPanel: string | null
  setFocusPanel: (id: string | null) => void
  pushToast: (toast: Omit<ToastItem, 'id'>) => number
  dismissToast: (id: number) => void
}

/** Toasts kept on screen at once; older ones are dropped. */
const MAX_TOASTS = 4
let nextToastId = 1

export const useUi = create<UiState>()((set) => ({
  toasts: [],
  sandboxStart: false,
  setSandboxStart: (sandboxStart) => set({ sandboxStart }),
  focusPanel: null,
  setFocusPanel: (focusPanel) => set({ focusPanel }),
  pushToast: (toast) => {
    const id = nextToastId++
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-MAX_TOASTS) }))
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
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
