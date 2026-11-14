/**
 * Reference designs for tests and the Planning debug panel.
 * Hand-checked numbers are in src/engine/__tests__/launchCheck.test.ts.
 */
import type { Design } from './types'

const CREW = ['mina-okafor', 'jonas-reyes', 'priya-natarajan', 'theo-lindqvist']

const GOOD_PARTS = [
  'solar-array-roll-10kw',
  'regen-fuel-cell-200kwh',
  'battery-li-50kwh',
  'high-gain-antenna',
  'ice-drill-spectrometer',
  'eclss-core',
  'habitat-inflatable-4',
  'eva-suit-pair',
  'spares-kit',
]

/** Shackleton Ice Hunt on a Medium launcher. Passes every check. */
export const GOOD_DESIGN: Design = {
  destinationId: 'moon',
  scenarioId: 'shackleton-ice-hunt',
  rocketId: 'medium-lunar-launcher',
  partIds: GOOD_PARTS,
  supplies: { oxygenKg: 110, foodKg: 230, waterKg: 40 },
  crewIds: CREW,
}

/** Same parts on a Light launcher with too little food: fails mass and supplies. */
export const BAD_DESIGN: Design = {
  ...GOOD_DESIGN,
  rocketId: 'light-lunar-launcher',
  supplies: { oxygenKg: 110, foodKg: 100, waterKg: 40 },
}
