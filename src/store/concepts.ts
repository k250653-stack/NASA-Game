/**
 * Concept event bus. The Planning Board emits a concept the first time the player meets it
 * (e.g. "mass_budget" the first time mass goes red). NOVA (a later prompt) subscribes to show
 * the matching lesson. Seen concepts are saved with the game so each fires once per save.
 */
import { useStore } from './index'

export const CONCEPTS = [
  'mass_budget',
  'power_dark',
  'life_support',
  'data_downlink',
  'launch_capacity',
  'go_no_go_poll',
  'dust_solar',
  'signal_delay',
] as const
export type ConceptKey = (typeof CONCEPTS)[number]

type Listener = (concept: ConceptKey) => void
const listeners = new Set<Listener>()

/** Subscribe to first-time concepts. Returns an unsubscribe function. */
export function subscribeConcepts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Records a concept the first time it happens and notifies subscribers. Later calls do nothing. */
export function emitConcept(concept: ConceptKey): void {
  const seen = useStore.getState().game.conceptsSeen
  if (seen.includes(concept)) return
  useStore.setState((s) => ({
    game: { ...s.game, conceptsSeen: [...s.game.conceptsSeen, concept] },
  }))
  if (import.meta.env.DEV) console.info(`[concept] ${concept}`)
  listeners.forEach((l) => l(concept))
}
