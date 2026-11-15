import { createContext, useContext } from 'react'

/**
 * Set by the world's PopupPanel: screens inside a popup use the popup's title bar ("PERSONNEL ·
 * RECRUIT CREW") instead of their own big header and top bar.
 */
export interface PopupInfo {
  /** Section name shown before the screen title, e.g. "Personnel". */
  section: string | null
}

export const PopupContext = createContext<PopupInfo | null>(null)

export function usePopup(): PopupInfo | null {
  return useContext(PopupContext)
}
