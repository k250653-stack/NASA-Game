/**
 * Reference designs for tests and the Planning debug panel.
 * Hand-checked numbers are in src/engine/__tests__/.
 */
import type { StandingOrders } from '@/schemas'
import type { Design } from './types'

const CREW = ['mina-okafor', 'jonas-reyes', 'priya-natarajan', 'theo-lindqvist']

/** Same as the scenarios' defaults. */
export const DEFAULT_ORDERS: StandingOrders = {
  powerEmergency: 'shed_science',
  crewInjury: 'rest',
  lowSupplies: 'ration',
  eva: 'best_available',
}

const MOON_PARTS = [
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

/** Shackleton Ice Hunt (34 days) on a Medium launcher. Passes every check. */
export const MOON_GOOD_DESIGN: Design = {
  destinationId: 'moon',
  scenarioId: 'shackleton-ice-hunt',
  rocketId: 'medium-lunar-launcher',
  partIds: MOON_PARTS,
  // 37 days needed (34 + 3 reserve): O2 130 ÷ 3.36 = 38.7, food 270 ÷ 7.2 = 37.5,
  // water 100 ÷ 1.2 = 83.3 (the extra 50 kg covers ~4 days with the recycler down).
  supplies: { oxygenKg: 130, foodKg: 270, waterKg: 100 },
  crewIds: CREW,
  standingOrders: DEFAULT_ORDERS,
  playerRole: 'power_life',
}

/** Same parts on a Light launcher with too little food: fails mass, supplies, feasibility. */
export const MOON_BAD_DESIGN: Design = {
  ...MOON_GOOD_DESIGN,
  rocketId: 'light-lunar-launcher',
  supplies: { oxygenKg: 130, foodKg: 100, waterKg: 50 },
}

const MARS_COMMON = [
  'fission-10kw',
  'habitat-rigid-6',
  'radiation-shelter',
  'high-gain-antenna',
  'ice-drill-spectrometer',
  'sample-lab',
  'eva-suit-pair',
  'spares-crate',
]

/** Jezero Long Stay (730 days) with 98% water and 75% oxygen recycling. Passes every check. */
export const MARS_GOOD_DESIGN: Design = {
  destinationId: 'mars',
  scenarioId: 'jezero-long-stay',
  rocketId: 'super-heavy-launcher',
  partIds: [...MARS_COMMON, 'eclss-advanced', 'oxygen-generator'],
  // 733 days needed: O2 800 ÷ 0.84 = 952, food 5,300 ÷ 7.2 = 736.1, water 800 ÷ 0.24 = 3,333.
  // Contingency: 600 kg water + 150 kg O2 cover about one 30-day cruise turn with recyclers down.
  supplies: { oxygenKg: 800, foodKg: 5300, waterKg: 800 },
  crewIds: CREW,
  standingOrders: { ...DEFAULT_ORDERS, eva: 'only_practical' },
  playerRole: 'power_life',
}

/** Same mission with open-loop life support: no recycling, so supplies and feasibility fail. */
export const MARS_BAD_DESIGN: Design = {
  ...MARS_GOOD_DESIGN,
  partIds: [...MARS_COMMON, 'eclss-open-loop'],
}

/** Aliases kept for the Moon-only tests and callers from the previous step. */
export const GOOD_DESIGN = MOON_GOOD_DESIGN
export const BAD_DESIGN = MOON_BAD_DESIGN
