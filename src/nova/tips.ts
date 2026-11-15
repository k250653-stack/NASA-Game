/**
 * Contextual NOVA tips (content/novaTips.json). Rules: at most one tip per TIP_GAP_MS of play,
 * never while an event popup or a hands-on task is open, never the same tip twice per run.
 * Setting "NOVA tips": lots (all) / some (important ones and facts only) / off.
 */
import { getContent } from '@/content/load'
import { useSettings } from '@/ui/settingsStore'
import type { NovaTip } from '@/schemas'
import { useNova } from './novaStore'

/** Minimum time between two tips, ms. */
const TIP_GAP_MS = 60_000
/** A tip stays up this long unless clicked away, ms. */
export const TIP_SHOW_MS = 14_000

export type TipMode = 'lots' | 'some' | 'off'

interface TipState {
  /** The tip on screen now. */
  current: NovaTip | null
}

let lastAt = -Infinity
const seenThisRun = new Set<string>()
const listeners = new Set<(s: TipState) => void>()
let state: TipState = { current: null }

function push(next: TipState) {
  state = next
  listeners.forEach((l) => l(state))
}
export const tipState = () => state
export function subscribeTips(fn: (s: TipState) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** A new mission launch starts a fresh "seen" list. */
export function resetTipsForRun(): void {
  seenThisRun.clear()
}

export function dismissTip(): void {
  push({ current: null })
}

const popupOpen = () =>
  document.querySelector(
    '[data-testid="event-popup"],[data-testid="proposal-popup"],[data-testid="task-panel"]',
  ) !== null

/** Shows the best unseen tip for this trigger, if the rules allow one right now. */
export function offerTip(trigger: string, now = Date.now()): void {
  const mode = useSettings.getState().novaTips
  if (mode === 'off') return
  if (now - lastAt < TIP_GAP_MS || popupOpen() || state.current) return
  const pool = getContent().novaTips.filter(
    (t) =>
      t.trigger === trigger &&
      !seenThisRun.has(t.id) &&
      (mode === 'lots' || t.important || t.kind === 'fact'),
  )
  // Facts rotate in order; situation tips are unique per trigger.
  const tip = pool[0]
  if (!tip) return
  seenThisRun.add(tip.id)
  lastAt = now
  const seen = useNova.getState().tipsSeen
  if (!seen.includes(tip.id)) useNova.setState({ tipsSeen: [...seen, tip.id] })
  push({ current: tip })
}
