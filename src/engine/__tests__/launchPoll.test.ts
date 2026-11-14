import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { runLaunchCheck } from '../launchCheck'
import { expectedScience, goNoGoPoll, overallCall } from '../launchPoll'
import { MOON_BAD_DESIGN, MOON_GOOD_DESIGN } from '../sampleDesigns'
import type { Design, EngineContent } from '../types'

const content = loadContent()
const poll = (d: Design, c: EngineContent = content) => goNoGoPoll(runLaunchCheck(d, c), d, c)
const line = (d: Design, role: string, c: EngineContent = content) =>
  poll(d, c).find((l) => l.role === role)!

describe('go / no-go poll', () => {
  it('a good design is GO from every seat, in launch-room order', () => {
    const lines = poll(MOON_GOOD_DESIGN)
    expect(lines.map((l) => l.role)).toEqual([
      'launch_budget',
      'power_life',
      'comms_nav',
      'science',
    ])
    expect(lines.every((l) => l.verdict === 'go')).toBe(true)
    expect(overallCall(runLaunchCheck(MOON_GOOD_DESIGN, content))).toBe('GO')
  })

  it("the player's own seat has no crew member (shown as 'Your call'); others name theirs", () => {
    // MOON_GOOD_DESIGN: the player flies Power & Life Support.
    expect(line(MOON_GOOD_DESIGN, 'power_life').crewId).toBeNull()
    expect(line(MOON_GOOD_DESIGN, 'launch_budget').crewId).toBe('kofi')
    expect(line(MOON_GOOD_DESIGN, 'comms_nav').crewId).toBe('lin')
  })

  it('any failing check -> NO-GO; each seat judges its own area with the numbers', () => {
    // MOON_BAD: 4,050 kg on a 3,000 kg Light launcher, 13.9 days of food for a 34-day mission.
    const lb = line(MOON_BAD_DESIGN, 'launch_budget')
    expect(lb.verdict).toBe('no-go')
    expect(lb.reason).toBe(
      "Total mass 4,050 kg exceeds the Light Lunar Launcher's 3,000 kg to Moon — South Pole by 1,050 kg.",
    )
    expect(line(MOON_BAD_DESIGN, 'power_life').verdict).toBe('no-go')
    expect(line(MOON_BAD_DESIGN, 'comms_nav').verdict).toBe('go')
    expect(overallCall(runLaunchCheck(MOON_BAD_DESIGN, content))).toBe('NO-GO')
  })

  it('warnings only -> GO WITH RISKS (260 kg food = 36.1 days: covers 34, not the 37-day reserve)', () => {
    const d: Design = {
      ...MOON_GOOD_DESIGN,
      supplies: { ...MOON_GOOD_DESIGN.supplies, foodKg: 260 },
    }
    expect(line(d, 'power_life').verdict).toBe('go-with-concerns')
    expect(line(d, 'power_life').reason).toMatch(/^Supplies last 36\.1 days/)
    expect(overallCall(runLaunchCheck(d, content))).toBe('GO WITH RISKS')
  })

  it('science: drill 4 pts/day × 28 surface days = 112 of 100 -> go; no instrument -> concerns', () => {
    expect(expectedScience(MOON_GOOD_DESIGN, content)).toBe(112)
    expect(line(MOON_GOOD_DESIGN, 'science').reason).toBe(
      'Our instruments should return about 112 science points against a target of 100 (112%).',
    )
    const noDrill: Design = {
      ...MOON_GOOD_DESIGN,
      partIds: MOON_GOOD_DESIGN.partIds.filter((id) => id !== 'ice-drill-spectrometer'),
    }
    expect(line(noDrill, 'science').verdict).toBe('go-with-concerns')
  })

  it('Launch & Budget raises a concern for a rocket below 92% reliability', () => {
    const shaky: EngineContent = {
      ...content,
      rockets: content.rockets.map((r) =>
        r.id === 'medium-lunar-launcher' ? { ...r, reliability: 0.9 } : r,
      ),
    }
    const lb = line(MOON_GOOD_DESIGN, 'launch_budget', shaky)
    expect(lb.verdict).toBe('go-with-concerns')
    expect(lb.reason).toBe(
      'The Medium Lunar Launcher is 90% reliable, below the 92% we like to fly.',
    )
    // No check warns, but a concerned seat still turns the call to GO WITH RISKS.
    const checks = runLaunchCheck(MOON_GOOD_DESIGN, shaky)
    expect(overallCall(checks)).toBe('GO')
    expect(overallCall(checks, goNoGoPoll(checks, MOON_GOOD_DESIGN, shaky))).toBe('GO WITH RISKS')
  })

  it('the Mission Director answers for every seat (no crew ids)', () => {
    const d: Design = { ...MOON_GOOD_DESIGN, playerRole: null }
    expect(poll(d).every((l) => l.crewId === null)).toBe(true)
  })

  it('is deterministic', () => {
    expect(poll(MOON_BAD_DESIGN)).toEqual(poll(MOON_BAD_DESIGN))
  })
})
