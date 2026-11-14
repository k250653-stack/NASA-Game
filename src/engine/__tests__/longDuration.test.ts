import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { canLaunch, runLaunchCheck } from '../launchCheck'
import { daysOfSupply, lifeSupportNeedKg } from '../physics'
import { MARS_BAD_DESIGN, MARS_GOOD_DESIGN, MOON_GOOD_DESIGN } from '../sampleDesigns'
import { missionTimeline, signalDelay, totalMissionDays, turnOutput } from '../timeline'
import type { Design } from '../types'

const content = loadContent()
const moon = content.destinations.find((d) => d.id === 'moon')!
const mars = content.destinations.find((d) => d.id === 'mars')!
const PER_DAY = { oxygenKg: 0.84, foodKg: 1.8, waterKg: 3.0, source: 'test' }
const failing = (d: Design) =>
  runLaunchCheck(d, content)
    .filter((c) => c.status === 'fail')
    .map((c) => c.id)

describe('phases and timeline', () => {
  it('phase days sum to each scenario duration (Moon 3+28+3 = 34, Mars 210+300+220 = 730)', () => {
    expect(totalMissionDays(moon)).toBe(34)
    expect(totalMissionDays(mars)).toBe(730)
    for (const s of content.scenarios) {
      const dest = content.destinations.find((d) => d.id === s.destinationId)!
      expect(totalMissionDays(dest)).toBe(s.durationDays)
    }
  })

  it('Moon timeline: 3/3 = 1 + 28/4 = 7 + 3/3 = 1 -> 9 turns', () => {
    const turns = missionTimeline(moon)
    expect(turns).toHaveLength(9)
    expect(turns.filter((t) => t.phaseId === 'surface')).toHaveLength(7)
    expect(turns.map((t) => t.days)).toEqual([3, 4, 4, 4, 4, 4, 4, 4, 3])
  })

  it('Mars timeline: 210/30 = 7, 300/15 = 20, 220/30 = 7 full + one 10-day turn = 8 -> 35 turns', () => {
    const turns = missionTimeline(mars)
    expect(turns).toHaveLength(35)
    const count = (id: string) => turns.filter((t) => t.phaseId === id).length
    expect([count('outbound'), count('surface'), count('return')]).toEqual([7, 20, 8])
    expect(turns.at(-1)).toMatchObject({
      phaseId: 'return',
      startDay: 720,
      days: 10,
      turnIndex: 34,
    })
  })

  it('turns are contiguous: each starts where the previous ended, ending on day 730', () => {
    const turns = missionTimeline(mars)
    turns.forEach((t, i) => {
      if (i > 0) expect(t.startDay).toBe(turns[i - 1]!.startDay + turns[i - 1]!.days)
    })
    const last = turns.at(-1)!
    expect(last.startDay + last.days).toBe(730)
    // Surface starts after the 210-day cruise.
    expect(turns.find((t) => t.location === 'surface')!.startDay).toBe(210)
  })
})

describe('signal delay', () => {
  it('Mars: 180 s at launch, 1,320 s mid-mission (day 365), back to 180 s at day 730', () => {
    expect(signalDelay(mars, 0)).toBeCloseTo(180, 6)
    expect(signalDelay(mars, 365)).toBeCloseTo(1320, 6)
    expect(signalDelay(mars, 730)).toBeCloseTo(180, 6)
  })

  it('Mars quarter-way (day 182.5): 180 + 1,140 × (1 − cos 90°) ÷ 2 = 750 s', () => {
    expect(signalDelay(mars, 182.5)).toBeCloseTo(750, 6)
  })
})

describe('long-duration life support', () => {
  it('2 years, no recycling: 4 × 730 × 3.0 = 8,760 kg water; × 0.84 = 2,452.8 kg O2', () => {
    const need = lifeSupportNeedKg(4, 730, PER_DAY, 0, 0)
    expect(need.water).toBeCloseTo(8760, 6)
    expect(need.oxygen).toBeCloseTo(2452.8, 6)
    expect(need.food).toBeCloseTo(5256, 6) // 4 × 730 × 1.8
  })

  it('85% water recovery leaves 15%: 8,760 × 0.15 = 1,314 kg', () => {
    expect(lifeSupportNeedKg(4, 730, PER_DAY, 0.85).water).toBeCloseTo(1314, 6)
  })

  it('75% oxygen recovery leaves 25%: 2,452.8 × 0.25 = 613.2 kg; food unchanged', () => {
    const need = lifeSupportNeedKg(4, 730, PER_DAY, 0.85, 0.75)
    expect(need.oxygen).toBeCloseTo(613.2, 6)
    expect(need.food).toBeCloseTo(5256, 6)
  })

  it('daysOfSupply with oxygen recovery: 650 kg ÷ (4 × 0.84 × 0.25 = 0.84/day) = 773.8 days', () => {
    const d = daysOfSupply({ oxygenKg: 650, foodKg: 5300, waterKg: 200 }, 4, PER_DAY, 0.98, 0.75)
    expect(d.oxygen).toBeCloseTo(773.81, 2)
    expect(d.food).toBeCloseTo(736.11, 2) // 5,300 ÷ 7.2
    expect(d.water).toBeCloseTo(833.33, 2) // 200 ÷ (12 × 0.02 = 0.24)
    expect(d.limiting).toBe('food')
  })
})

describe('surface-only parts', () => {
  it('produce zero science and data during transit turns', () => {
    const turns = missionTimeline(mars)
    const cruise = turns.find((t) => t.location === 'transit')!
    const out = turnOutput(MARS_GOOD_DESIGN, content, cruise)
    expect(out.sciencePoints).toBe(0)
    expect(out.dataGenGb).toBe(0)
  })

  it('a 15-day Mars surface turn: (drill 4 + lab 6) × 15 = 150 points; data (2 + 1) × 15 = 45 GB', () => {
    const surface = missionTimeline(mars).find((t) => t.location === 'surface')!
    const out = turnOutput(MARS_GOOD_DESIGN, content, surface)
    expect(out.sciencePoints).toBe(150)
    expect(out.dataGenGb).toBe(45)
    // Link capacity 10 Mbps × 3,600 × 8 h ÷ 8,000 = 36 GB/day × 15 = 540 GB, so all 45 GB get home.
    expect(out.dataReturnGb).toBe(45)
  })

  it('whole Moon mission science: only the 28 surface days count -> 4 × 28 = 112 points', () => {
    const total = missionTimeline(moon).reduce(
      (sum, t) => sum + turnOutput(MOON_GOOD_DESIGN, content, t).sciencePoints,
      0,
    )
    expect(total).toBe(112)
  })
})

describe('Mars launch check', () => {
  it('design with recyclers passes every check', () => {
    const checks = runLaunchCheck(MARS_GOOD_DESIGN, content)
    expect(checks.filter((c) => c.status !== 'ok')).toEqual([])
    expect(canLaunch(checks)).toBe(true)
  })

  it('feasibility explains the savings: 8,760 -> 175 kg water, 2,453 -> 613 kg O2, saving 10,424 kg', () => {
    // water 8,760 × 0.02 = 175.2; O2 2,452.8 × 0.25 = 613.2
    // saved = (8,760 − 175.2) + (2,452.8 − 613.2) = 10,424.4
    // dry = parts 10,070 + crew 400 = 10,470; supplies 613.2 + 5,256 + 175.2 = 6,044.4; total 16,514.4
    const c = runLaunchCheck(MARS_GOOD_DESIGN, content).find((x) => x.id === 'supply-feasibility')!
    expect(c.explanation).toBe(
      'Without recycling, 730 days need 8,760 kg of water and 2,453 kg of oxygen. ' +
        'Your 98% water recycler cuts water to 175 kg and your 75% oxygen system cuts oxygen to 613 kg, saving 10,424 kg. ' +
        "Dry mass 10,470 kg plus 6,044 kg of required supplies is 16,514 kg against the Super Heavy Launcher's 25,000 kg.",
    )
  })

  it('design without recyclers fails exactly supplies and supply feasibility', () => {
    // Water: 200 kg ÷ 12 kg/day = 16.7 days. Feasibility: dry 9,320 + 16,468.8 = 25,788.8 > 25,000.
    expect(failing(MARS_BAD_DESIGN)).toEqual(['supplies', 'supply-feasibility'])
    const c = runLaunchCheck(MARS_BAD_DESIGN, content).find((x) => x.id === 'supply-feasibility')!
    expect(c.explanation).toMatch(/No recyclers on board/)
    expect(c.explanation).toMatch(/789 kg too heavy\.$/)
  })
})
