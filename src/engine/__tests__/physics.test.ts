import { describe, expect, it } from 'vitest'
import {
  batteryMarginRatio,
  batteryNeededWh,
  dataReturnedGbPerDay,
  daysOfSupply,
  lifeSupportNeedKg,
  orbitalPeriodMin,
  solarOutputW,
} from '../physics'

/** Same values as constants.json, written out so the hand calculations are visible. */
const PER_DAY = { oxygenKg: 0.84, foodKg: 1.8, waterKg: 3.0, source: 'test' }

describe('solarOutputW', () => {
  it('Moon, day 0: 10,000 W × 1.0 sun × 0.7 light × 1 = 7,000 W', () => {
    expect(solarOutputW(10000, 1.0, 0.7, 0.0005, 0)).toBe(7000)
  })

  it('Moon, day 28 dust: 5,000 × 0.7 = 3,500 × 0.9995^28 (0.986094) = 3,451.33 W', () => {
    expect(solarOutputW(5000, 1.0, 0.7, 0.0005, 28)).toBeCloseTo(3451.33, 1)
  })

  it('Mars, day 10: 10,000 × 0.43 × 0.5 = 2,150 × 0.998^10 (0.980179) = 2,107.39 W', () => {
    expect(solarOutputW(10000, 0.43, 0.5, 0.002, 10)).toBeCloseTo(2107.39, 1)
  })

  it('total dust loss (1.0/day) leaves 0 W after one day', () => {
    expect(solarOutputW(10000, 1, 1, 1, 1)).toBe(0)
  })
})

describe('battery', () => {
  it('needed Wh: 2,100 W × 100 h = 210,000 Wh', () => {
    expect(batteryNeededWh(2100, 100)).toBe(210000)
  })

  it('margin ratio: 250,000 ÷ 210,000 = 1.1905', () => {
    expect(batteryMarginRatio(250000, 210000)).toBeCloseTo(1.1905, 4)
  })

  it('battery exactly equal to need gives ratio 1 (just enough)', () => {
    expect(batteryMarginRatio(210000, 210000)).toBe(1)
  })

  it('nothing needed is always enough (Infinity)', () => {
    expect(batteryMarginRatio(0, 0)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('dataReturnedGbPerDay', () => {
  it('Moon HGA: 10 Mbps × 3,600 × 24 h ÷ 8,000 = 108 GB/day', () => {
    expect(dataReturnedGbPerDay(10, 24)).toBe(108)
  })

  it('Mars HGA: 10 Mbps × 3,600 × 8 h ÷ 8,000 = 36 GB/day', () => {
    expect(dataReturnedGbPerDay(10, 8)).toBe(36)
  })

  it('low-gain: 0.5 Mbps × 3,600 × 24 ÷ 8,000 = 5.4 GB/day', () => {
    expect(dataReturnedGbPerDay(0.5, 24)).toBeCloseTo(5.4, 10)
  })
})

describe('lifeSupportNeedKg', () => {
  it('4 crew × 28 days, no recycling: O2 94.08, food 201.6, water 336 kg', () => {
    // 4 × 28 = 112 crew-days. 112 × 0.84 = 94.08; 112 × 1.8 = 201.6; 112 × 3.0 = 336.
    const need = lifeSupportNeedKg(4, 28, PER_DAY, 0)
    expect(need.oxygen).toBeCloseTo(94.08, 10)
    expect(need.food).toBeCloseTo(201.6, 10)
    expect(need.water).toBeCloseTo(336, 10)
  })

  it('90% recycling cuts only water: 336 × 0.1 = 33.6 kg', () => {
    const need = lifeSupportNeedKg(4, 28, PER_DAY, 0.9)
    expect(need.water).toBeCloseTo(33.6, 10)
    expect(need.oxygen).toBeCloseTo(94.08, 10)
  })

  it('recovery rate 1.0 needs no water at all', () => {
    expect(lifeSupportNeedKg(4, 28, PER_DAY, 1).water).toBe(0)
  })

  it('zero crew needs nothing', () => {
    expect(lifeSupportNeedKg(0, 28, PER_DAY, 0)).toEqual({ oxygen: 0, food: 0, water: 0 })
  })
})

describe('daysOfSupply', () => {
  it('good-design supplies: food limits at 230 ÷ 7.2 = 31.94 days', () => {
    // O2 110 ÷ (4 × 0.84 = 3.36) = 32.74; food 230 ÷ (4 × 1.8 = 7.2) = 31.94;
    // water 40 ÷ (4 × 3.0 × 0.1 = 1.2) = 33.33.
    const d = daysOfSupply({ oxygenKg: 110, foodKg: 230, waterKg: 40 }, 4, PER_DAY, 0.9)
    expect(d.oxygen).toBeCloseTo(32.738, 3)
    expect(d.food).toBeCloseTo(31.944, 3)
    expect(d.water).toBeCloseTo(33.333, 3)
    expect(d.limiting).toBe('food')
    expect(d.days).toBeCloseTo(31.944, 3)
  })

  it('zero supplies last 0 days (oxygen named first on a tie)', () => {
    const d = daysOfSupply({ oxygenKg: 0, foodKg: 0, waterKg: 0 }, 4, PER_DAY, 0)
    expect(d.days).toBe(0)
    expect(d.limiting).toBe('oxygen')
  })

  it('zero crew: supplies last forever', () => {
    const d = daysOfSupply({ oxygenKg: 10, foodKg: 10, waterKg: 10 }, 0, PER_DAY, 0)
    expect(d.days).toBe(Number.POSITIVE_INFINITY)
  })

  it('recovery 1.0: water never runs out, even with 0 kg packed', () => {
    const d = daysOfSupply({ oxygenKg: 110, foodKg: 230, waterKg: 0 }, 4, PER_DAY, 1)
    expect(d.water).toBe(Number.POSITIVE_INFINITY)
    expect(d.limiting).toBe('food')
  })
})

describe('orbitalPeriodMin', () => {
  it('ISS: a = 6,371 + 400 = 6,771 km; 2π√(6771³ ÷ 398,600.44) = 5,544.8 s = 92.41 min', () => {
    expect(orbitalPeriodMin(400, 6371, 398600.4418)).toBeCloseTo(92.41, 1)
  })

  it('Low lunar orbit: a = 1,737.4 + 100 = 1,837.4 km; μ 4,902.8 -> 7,067.6 s = 117.79 min', () => {
    expect(orbitalPeriodMin(100, 1737.4, 4902.8)).toBeCloseTo(117.8, 1)
  })
})
