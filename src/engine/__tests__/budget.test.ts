import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { computeMargins, computeTotals, marginRatio, resolveDesign } from '../budget'
import { GOOD_DESIGN } from '../sampleDesigns'

const content = loadContent()

describe('computeTotals (good design)', () => {
  const t = computeTotals(GOOD_DESIGN, content)

  it('mass: parts 3,370 + supplies 450 + crew 4 × 100 = 4,220 kg', () => {
    // parts: 140 + 900 + 350 + 35 + 45 + 400 + 1,200 + 240 + 60 = 3,370
    // supplies: 130 O2 + 270 food + 50 water = 450
    expect(t.partsMassKg).toBe(3370)
    expect(t.suppliesKg).toBe(450)
    expect(t.crewMassKg).toBe(400)
    expect(t.massKg).toBe(4220)
  })

  it('power: 10 kW × 1.0 × 0.7 = 7,000 W generated; 1,500 + 80 + 120 + 400 = 2,100 W used', () => {
    expect(t.powerGenW).toBe(7000)
    expect(t.powerUseW).toBe(2100)
    expect(t.steadyGenW).toBe(0)
  })

  it('cost: parts 500 + Medium launcher 150 + salaries 7.8 = $657.8M', () => {
    // parts: 60 + 120 + 15 + 18 + 38 + 95 + 120 + 28 + 6 = 500
    // salaries: 2.1 + 1.8 + 2.4 + 1.5 = 7.8
    expect(t.costM).toBeCloseTo(657.8, 10)
  })

  it('data, science and capacities', () => {
    // data return: 10 Mbps × 3,600 × 24 ÷ 8,000 = 108 GB/day
    expect(t.dataGenGbPerDay).toBe(2)
    expect(t.dataReturnGbPerDay).toBe(108)
    expect(t.sciencePerDay).toBe(4)
    expect(t.batteryWh).toBe(250000) // 200,000 fuel cell + 50,000 battery
    expect(t.waterRecoveryRate).toBe(0.9)
    expect(t.suitCount).toBe(2)
    expect(t.crewCapacity).toBe(4)
    expect(t.crewCount).toBe(4)
  })
})

describe('computeTotals edge cases', () => {
  it('a repeated part id counts twice: +350 kg and +50,000 Wh', () => {
    const t = computeTotals(
      { ...GOOD_DESIGN, partIds: [...GOOD_DESIGN.partIds, 'battery-li-50kwh'] },
      content,
    )
    expect(t.partsMassKg).toBe(3720)
    expect(t.batteryWh).toBe(300000)
  })

  it('fission counts as steady generation that works in the dark', () => {
    const t = computeTotals({ ...GOOD_DESIGN, partIds: ['fission-10kw'] }, content)
    expect(t.steadyGenW).toBe(10000)
    expect(t.powerGenW).toBe(10000)
  })

  it('an unknown id throws a readable error', () => {
    expect(() => resolveDesign({ ...GOOD_DESIGN, partIds: ['warp-drive'] }, content)).toThrow(
      'Design references unknown part "warp-drive"',
    )
  })
})

describe('margins', () => {
  it('good design: mass 0.4725, power 0.7, budget 0.45183, data 0.98148', () => {
    const { rocket, scenario, destination } = resolveDesign(GOOD_DESIGN, content)
    const m = computeMargins(computeTotals(GOOD_DESIGN, content), rocket, scenario, destination)
    expect(m.mass).toBeCloseTo(0.4725, 5) // (8,000 − 4,220) ÷ 8,000
    expect(m.power).toBeCloseTo(0.7, 10) // (7,000 − 2,100) ÷ 7,000
    expect(m.budget).toBeCloseTo(0.451833, 5) // (1,200 − 657.8) ÷ 1,200
    expect(m.data).toBeCloseTo(0.981481, 5) // (108 − 2) ÷ 108
  })

  it('marginRatio edge cases: nothing available', () => {
    expect(marginRatio(0, 5)).toBe(-1)
    expect(marginRatio(0, 0)).toBe(0)
    expect(marginRatio(100, 100)).toBe(0)
  })
})
