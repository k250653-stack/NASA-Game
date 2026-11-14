import type { CheckId } from '@/engine/types'

/** Where each check is fixed: a Planning Board panel, or the Recruit screen. */
export const FIX_TARGET: Record<CheckId, { phase: 'planning' | 'recruit'; panel?: string }> = {
  mass: { phase: 'planning', panel: 'panel-launcher' },
  budget: { phase: 'planning', panel: 'panel-catalog' },
  power: { phase: 'planning', panel: 'panel-catalog' },
  battery: { phase: 'planning', panel: 'panel-catalog' },
  data: { phase: 'planning', panel: 'panel-catalog' },
  habitat: { phase: 'planning', panel: 'panel-catalog' },
  supplies: { phase: 'planning', panel: 'panel-supplies' },
  'supply-feasibility': { phase: 'planning', panel: 'panel-supplies' },
  suits: { phase: 'planning', panel: 'panel-supplies' },
  'crew-count': { phase: 'recruit' },
}
