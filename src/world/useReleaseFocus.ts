import { useEffect, useRef } from 'react'

/**
 * When the last popup/menu over a world closes, give the keyboard back to the game.
 *
 * A closing Modal returns focus to whatever was focused when it opened (a button, the NOVA
 * bubble...). Keys then go to that element first, and any React handler there that calls
 * preventDefault (arrow-key menus do) makes Phaser ignore the key, so the player looks frozen.
 * Blurring the leftover focus sends keys straight to the game again.
 */
export function useReleaseFocus(busy: boolean): void {
  const wasBusy = useRef(busy)
  useEffect(() => {
    if (wasBusy.current && !busy) {
      // After the closing dialog's own cleanup has restored focus.
      const t = window.setTimeout(() => {
        const el = document.activeElement
        if (el instanceof HTMLElement && el !== document.body) el.blur()
      }, 0)
      wasBusy.current = busy
      return () => window.clearTimeout(t)
    }
    wasBusy.current = busy
  }, [busy])
}
