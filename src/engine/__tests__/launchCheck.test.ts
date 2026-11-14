import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { canLaunch, runLaunchCheck } from '../launchCheck'
import { BAD_DESIGN, GOOD_DESIGN } from '../sampleDesigns'
import type { CheckId, Design } from '../types'

const content = loadContent()
const run = (d: Design) => runLaunchCheck(d, content)
const check = (d: Design, id: CheckId) => run(d).find((c) => c.id === id)!
const failing = (d: Design) =>
  run(d)
    .filter((c) => c.status === 'fail')
    .map((c) => c.id)
const withParts = (partIds: string[]): Design => ({ ...GOOD_DESIGN, partIds })

describe('full designs', () => {
  it('good design passes every check', () => {
    const checks = run(GOOD_DESIGN)
    expect(checks.map((c) => c.id)).toEqual([
      'mass',
      'budget',
      'power',
      'battery',
      'supplies',
      'suits',
      'data',
      'crew-count',
      'habitat',
      'supply-feasibility',
    ])
    expect(checks.filter((c) => c.status !== 'ok')).toEqual([])
    expect(canLaunch(checks)).toBe(true)
  })

  it('bad design fails exactly mass, supplies and supply feasibility', () => {
    // Mass: 3,370 parts + (130 + 100 + 50) supplies + 400 crew = 4,050 kg > 3,000 kg Light.
    // Food: 100 ÷ 7.2 = 13.9 days < 34-day mission (3 + 28 + 3).
    // Feasibility: 3,770 dry + 34-day needs (114.24 O2 + 244.8 food + 40.8 water) = 4,170 kg > 3,000.
    expect(failing(BAD_DESIGN)).toEqual(['mass', 'supplies', 'supply-feasibility'])
    expect(canLaunch(run(BAD_DESIGN))).toBe(false)
    expect(check(BAD_DESIGN, 'mass').explanation).toBe(
      "Total mass 4,050 kg exceeds the Light Lunar Launcher's 3,000 kg to Moon — South Pole by 1,050 kg.",
    )
    expect(check(BAD_DESIGN, 'supplies').explanation).toMatch(
      /^Supplies last 13\.9 days \(food runs out first\); the mission needs 34 days plus a 3-day reserve = 37 days\.$/,
    )
  })
})

describe('mass', () => {
  it('exactly at capacity is not a failure (warns: 0% < 5% margin target)', () => {
    // 3,370 parts + 130 O2 + 270 food + 3,830 water + 400 crew = 8,000 kg = Medium capacity.
    const d = { ...GOOD_DESIGN, supplies: { ...GOOD_DESIGN.supplies, waterKg: 50 + 3780 } }
    const c = check(d, 'mass')
    expect(c.value).toBe(8000)
    expect(c.limit).toBe(8000)
    expect(c.status).toBe('warn')
    expect(canLaunch(run(d))).toBe(true)
  })

  it('no rocket selected fails', () => {
    expect(check({ ...GOOD_DESIGN, rocketId: null }, 'mass').status).toBe('fail')
  })
})

describe('power and battery', () => {
  it('negative power margin fails: no solar, 0 W against a 2,100 W load', () => {
    const d = withParts(GOOD_DESIGN.partIds.filter((id) => id !== 'solar-array-roll-10kw'))
    const c = check(d, 'power')
    expect(c.status).toBe('fail')
    expect(c.explanation).toBe(
      'Systems draw 2,100 W but power sources average only 0 W, a 2,100 W shortfall.',
    )
  })

  it('battery exactly equal to need passes: (2,100 + 400 rover) W × 100 h = 250,000 Wh', () => {
    const c = check(withParts([...GOOD_DESIGN.partIds, 'rover-mini']), 'battery')
    expect(c.limit).toBe(250000)
    expect(c.value).toBe(250000)
    expect(c.status).toBe('ok')
  })

  it('battery short fails: 1 × 50 kWh pack vs 210,000 Wh needed', () => {
    const d = withParts(GOOD_DESIGN.partIds.filter((id) => id !== 'regen-fuel-cell-200kwh'))
    expect(check(d, 'battery').status).toBe('fail')
  })

  it('fission covers the dark load, so no battery is needed', () => {
    // 10,000 W steady > 2,100 W load -> dark load 0 -> 0 Wh needed.
    const d = withParts([
      'fission-10kw',
      'high-gain-antenna',
      'ice-drill-spectrometer',
      'eclss-core',
      'habitat-inflatable-4',
      'eva-suit-pair',
    ])
    const c = check(d, 'battery')
    expect(c.limit).toBe(0)
    expect(c.status).toBe('ok')
  })
})

describe('supplies, crew and habitat', () => {
  it('covers the mission but not the reserve -> warn (260 ÷ 7.2 = 36.1 days: >= 34, < 37)', () => {
    const d = { ...GOOD_DESIGN, supplies: { ...GOOD_DESIGN.supplies, foodKg: 260 } }
    expect(check(d, 'supplies').status).toBe('warn')
  })

  it('zero crew: crew size fails, supplies/suits/habitat are fine', () => {
    const d = { ...GOOD_DESIGN, crewIds: [] }
    expect(failing(d)).toEqual(['crew-count'])
    expect(check(d, 'supplies').value).toBe(Number.POSITIVE_INFINITY)
  })

  it('a 2-crew cabin cannot house 4 crew', () => {
    const d = withParts(
      GOOD_DESIGN.partIds.map((id) => (id === 'habitat-inflatable-4' ? 'lander-cabin-2' : id)),
    )
    expect(check(d, 'habitat').status).toBe('fail')
  })

  it('EVA-capable crew with no suits fails', () => {
    const d = withParts(GOOD_DESIGN.partIds.filter((id) => id !== 'eva-suit-pair'))
    expect(check(d, 'suits').status).toBe('fail')
  })
})

describe('data', () => {
  it('low-gain + 2 radars: 5.4 GB/day sent of 2 + 8 + 8 = 18 GB/day (30%) -> warn', () => {
    const d = withParts([
      ...GOOD_DESIGN.partIds.filter((id) => id !== 'high-gain-antenna'),
      'low-gain-antenna',
      'ground-radar',
      'ground-radar',
    ])
    const c = check(d, 'data')
    expect(c.limit).toBe(18)
    expect(c.value).toBeCloseTo(5.4, 10)
    expect(c.status).toBe('warn')
  })
})
