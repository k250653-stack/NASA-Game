import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { suggestTeam } from '../crewAI'
import { destinationSummary } from '../destinationInfo'
import { effectiveBudgetM } from '../difficulty'
import { eventChance } from '../events'
import { launchCheckBudget } from './helpers'
import { initMission } from '../mission'
import {
  playerCharacterId,
  recruitCandidate,
  teamAnalysis,
  validateCallsign,
  validateTeam,
  type TeamDraft,
} from '../recruitment'
import { MOON_GOOD_DESIGN } from '../sampleDesigns'
import type { Design } from '../types'

const content = loadContent()
const moon = content.scenarios.find((s) => s.id === 'shackleton-ice-hunt')!
const draft = (over: Partial<TeamDraft> = {}): TeamDraft => ({
  scenarioId: 'shackleton-ice-hunt',
  difficulty: 'engineer',
  roleChoice: 'science',
  crewIds: [],
  ...over,
})

describe('difficulty modifiers', () => {
  it('budget: Cadet 1,200 × 1.25 = 1,500; Flight Director 1,200 × 0.8 = 960 ($M)', () => {
    expect(effectiveBudgetM(moon, 'cadet', content)).toBe(1500)
    expect(effectiveBudgetM(moon, 'engineer', content)).toBe(1200)
    expect(effectiveBudgetM(moon, 'flight_director', content)).toBe(960)
    // The launch check uses the multiplied budget.
    const fd: Design = { ...MOON_GOOD_DESIGN, difficulty: 'flight_director' }
    expect(launchCheckBudget(fd).limit).toBe(960)
  })

  it('event chance: solar panel damage 0.08 × 0.7 (Cadet) = 0.056, × 1.3 (Flight Director) = 0.104', () => {
    const event = content.events.find((e) => e.id === 'solar-panel-damage')!
    const chance = (d: Design) =>
      eventChance(event, initMission(d, content, 1), { design: d, content })
    expect(chance({ ...MOON_GOOD_DESIGN, difficulty: 'cadet' })).toBeCloseTo(0.056, 10)
    expect(chance(MOON_GOOD_DESIGN)).toBeCloseTo(0.08, 10)
    expect(chance({ ...MOON_GOOD_DESIGN, difficulty: 'flight_director' })).toBeCloseTo(0.104, 10)
  })

  it('hints follow the difficulty; part failures are not scaled', () => {
    expect(initMission({ ...MOON_GOOD_DESIGN, difficulty: 'cadet' }, content, 1).hintsEnabled).toBe(
      true,
    )
    expect(
      initMission({ ...MOON_GOOD_DESIGN, difficulty: 'flight_director' }, content, 1).hintsEnabled,
    ).toBe(false)
    const recycler = content.events.find((e) => e.id === 'recycler-failure')!
    const fd: Design = { ...MOON_GOOD_DESIGN, difficulty: 'flight_director' }
    expect(eventChance(recycler, initMission(fd, content, 1), { design: fd, content })).toBeCloseTo(
      0.02,
      10,
    )
  })
})

describe('team rules', () => {
  it('player characters: one per seat, never recruitable', () => {
    expect(playerCharacterId('power_life')).toBe('player-power-life')
    expect(playerCharacterId('director')).toBe('player-director')
    expect(recruitCandidate(draft(), 'player-power-life', content).refused).toBe(
      'Unknown crew member.',
    )
  })

  it('an empty team lists what is missing; a full one-per-role team is valid', () => {
    const empty = validateTeam(draft(), content)
    expect(empty.valid).toBe(false)
    expect(empty.slots).toBe(3)
    expect(empty.reasons[0]).toBe('Recruit 3 more crew (0 of 3 seats filled).')
    const ok = validateTeam(draft({ crewIds: ['bilal', 'lin', 'kofi'] }), content)
    expect(ok).toMatchObject({
      valid: true,
      reasons: [],
      salaryM: 120,
      budgetM: 1200,
      remainingM: 1080,
    })
  })

  it('recruiting someone for a filled role swaps them; your own role is refused', () => {
    const t = draft({ crewIds: ['bilal', 'lin'] })
    expect(recruitCandidate(t, 'sana', content)).toEqual({
      crewIds: ['sana', 'lin'],
      replacedId: 'bilal',
    })
    expect(recruitCandidate(t, 'maya', content).refused).toBe('You already cover Science.')
  })

  it('Mission Director: any 3 crew, roles may repeat, no swaps', () => {
    const t = draft({ roleChoice: 'director', crewIds: ['bilal', 'sana'] })
    expect(recruitCandidate(t, 'ayesha', content).crewIds).toEqual(['bilal', 'sana', 'ayesha'])
    expect(validateTeam({ ...t, crewIds: ['bilal', 'sana', 'ayesha'] }, content).valid).toBe(true)
    expect(
      recruitCandidate({ ...t, crewIds: ['bilal', 'sana', 'ayesha'] }, 'lin', content).refused,
    ).toBe('All 3 seats are taken: remove someone first.')
  })

  it('callsign: up to 16 safe characters; empty means "You"', () => {
    expect(validateCallsign('')).toEqual({ ok: true })
    expect(validateCallsign('Eagle-1')).toEqual({ ok: true })
    expect(validateCallsign('ThisCallsignIsWayTooLong').ok).toBe(false)
    expect(validateCallsign('<script>').ok).toBe(false)
  })
})

describe('suggestTeam', () => {
  it('picks a valid, balanced team within budget for every seat', () => {
    for (const roleChoice of [
      'science',
      'power_life',
      'comms_nav',
      'launch_budget',
      'director',
    ] as const) {
      const t = draft({ roleChoice })
      const ids = suggestTeam(t, content)!
      expect(ids, roleChoice).not.toBeNull()
      expect(validateTeam({ ...t, crewIds: ids }, content).valid).toBe(true)
      expect(teamAnalysis({ ...t, crewIds: ids }, content).warnings).toEqual([])
    }
  })

  it('Science seat: the best balanced team (thinker + practical + one leader)', () => {
    // Candidates by role: power (Bilal P, Sana T), comms (Lin L+T, Omar P), launch (Kofi P+L, Zara L).
    // Only Sana + Omar + (Kofi or Zara) have a Thinker, a Practical and exactly one Leader.
    // Sana + Omar + Kofi: 5 × (3 + 3 + 3) − (14 + 22 + 30) ÷ 10 = 45 − 6.6 = 38.4
    // Sana + Omar + Zara: 5 × (3 + 3 + 2) − (14 + 22 + 35) ÷ 10 = 40 − 7.1 = 32.9
    expect(suggestTeam(draft(), content)).toEqual(['sana', 'kofi', 'omar'])
  })
})

describe('destination summary', () => {
  it('formats card facts from content: Moon 34 days, Mars ~2 years and 3–22 min delay', () => {
    const moonDest = content.destinations.find((d) => d.id === 'moon')!
    const marsDest = content.destinations.find((d) => d.id === 'mars')!
    expect(destinationSummary(moonDest)).toMatchObject({
      missionLength: '34 days',
      signalDelay: '1.19–1.35 s',
      sunlight: '70%',
      resupply: 'Yes',
    })
    expect(destinationSummary(marsDest)).toMatchObject({
      missionLength: '~2 years',
      signalDelay: '3–22 min',
      sunlight: '22%',
      resupply: 'No',
    })
  })
})
