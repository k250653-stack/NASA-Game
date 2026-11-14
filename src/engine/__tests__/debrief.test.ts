import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { autoRun } from '../autopilot'
import {
  analyzeCauses,
  buildCauseContext,
  runDetectors,
  selectCauses,
  type CauseChain,
} from '../causes'
import { compareRuns } from '../compareRuns'
import { resolveEvent } from '../events'
import { advanceTurn, initMission } from '../mission'
import { createRng } from '../rng'
import { MARS_GOOD_DESIGN, MOON_GOOD_DESIGN } from '../sampleDesigns'
import { computeScore } from '../score'
import type { Design, EngineContent, MissionState, TurnSnapshot } from '../types'

const content = loadContent()
const quiet: EngineContent = { ...content, events: [] }
const without = (d: Design, partId: string): Design => ({
  ...d,
  partIds: d.partIds.filter((id) => id !== partId),
})

/** Appends a hand-built turn snapshot using the state's current numbers. */
function snap(s: MissionState, p: Partial<TurnSnapshot> & { turn: number; day: number }): void {
  s.turnHistory.push({
    days: 4,
    phaseId: 'surface',
    location: 'surface',
    resources: { ...s.resources },
    crew: Object.fromEntries(
      Object.entries(s.crew).map(([id, c]) => [id, [c.energy, c.morale, c.health]]),
    ),
    eventIds: [],
    disabledParts: [],
    dataLostGb: 0,
    batteryEmpty: false,
    scienceShed: false,
    lifeSupportDegraded: false,
    rationing: false,
    ...p,
  })
}

/** Runs every detector and returns the chains with this id (should be exactly one). */
function detect(s: MissionState, design: Design, id: string): CauseChain[] {
  return runDetectors(buildCauseContext(s, design, content)).filter((c) => c.id === id)
}

describe('cause detectors (hand-built histories)', () => {
  it('supply ran out: water on day 24, packed vs needed, traded for the drill', () => {
    const d: Design = {
      ...MOON_GOOD_DESIGN,
      supplies: { ...MOON_GOOD_DESIGN.supplies, waterKg: 50 },
    }
    const s = initMission(d, content, 1)
    s.outcome = 'failed'
    s.failure = { kind: 'supply', resource: 'water', day: 24 }
    const [chain, ...rest] = detect(s, d, 'supply-ran-out')
    expect(rest).toEqual([])
    expect(chain).toMatchObject({
      severity: 'critical',
      headline: 'Water ran out on day 24',
      rootDesignDecision: { field: 'supplies.waterKg', value: 50, label: 'Water packed' },
    })
    // 50 kg ÷ (4 crew × 3.0 kg × (1 − 0.9)) = 41.7 days; needed 34 + 3 = 37.
    expect(chain!.steps[1]).toBe(
      'You packed 41.7 days of water for 4 crew (50 kg); the mission needed 37 days.',
    )
    // 45 kg drill ÷ 1.2 kg/day = 37.5 days.
    expect(chain!.steps).toContain(
      'The Ice Drill + Spectrometer (+45 kg) took mass that could have carried 37.5 more days of water.',
    )
    // 37 − 24 = 13 days × 1.2 kg = 15.6 kg.
    expect(chain!.suggestion).toBe('Pack 13 more days of water (+16 kg).')
  })

  it('supply ran out without a recycler suggests adding the lightest one', () => {
    const d: Design = {
      ...MOON_GOOD_DESIGN,
      partIds: MOON_GOOD_DESIGN.partIds.map((id) => (id === 'eclss-core' ? 'eclss-open-loop' : id)),
    }
    const s = initMission(d, content, 1)
    s.outcome = 'failed'
    s.failure = { kind: 'supply', resource: 'water', day: 5 }
    expect(detect(s, d, 'supply-ran-out')[0]!.suggestion).toMatch(
      /^Add the Life Support Core \(ECLSS\) \(−90% water use\) or pack \d+ more days of water \(\+[\d,]+ kg\)\.$/,
    )
  })

  it('power shortfall: battery 50,000 Wh vs 2,100 W × 100 h = 210,000 Wh needed', () => {
    const d = without(MOON_GOOD_DESIGN, 'regen-fuel-cell-200kwh')
    const s = initMission(d, content, 1)
    snap(s, { turn: 3, day: 12, batteryEmpty: true, lifeSupportDegraded: true })
    const chains = detect(s, d, 'power-shortfall')
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({
      severity: 'major',
      headline: 'Power ran short from day 12',
      rootDesignDecision: { label: 'Battery capacity', value: '50,000 Wh' },
    })
    expect(chains[0]!.steps[1]).toBe(
      'The longest dark period is 100 h: at 2,100 W that needs 210,000 Wh, and you carried 50,000 Wh.',
    )
    expect(chains[0]!.suggestion).toBe(
      'Add 1 × Regenerative Fuel Cell (200 kWh) (+900 kg) to cover the 210,000 Wh night.',
    )
  })

  it('data lost: 30 GB lost + 10 GB stuck of 60 GB collected = 67%, root is the antenna', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    s.resources.scienceGb = 20
    s.resources.dataBacklogGb = 10
    s.changes.push({
      turn: 2,
      day: 8,
      resource: 'dataLostGb',
      delta: 30,
      sourceType: 'failure',
      sourceId: 'data-storage',
      note: '',
    })
    const chains = detect(s, MOON_GOOD_DESIGN, 'data-lost')
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({
      severity: 'major',
      headline: '67% of the science data never reached Earth',
      rootDesignDecision: { label: 'Comms system', value: 'High-Gain Antenna' },
    })
    expect(chains[0]!.suggestion).toBe(
      'Swap to the Optical Laser Terminal (200 Mbps = 2,160 GB/day).',
    )
  })

  it('repair failures with no Practical crew trace back to recruitment', () => {
    const d: Design = { ...MOON_GOOD_DESIGN, crewIds: ['mina-okafor', 'priya-natarajan'] }
    const s = initMission(d, content, 1)
    for (const day of [4, 12]) {
      s.decisions.push({
        turn: day / 4,
        day,
        eventId: 'battery-fault',
        optionId: 'replace-cell',
        crewId: 'mina-okafor',
        success: false,
        chance: 0.5,
        crewEnergy: 90,
        handledBy: 'ai',
      })
    }
    const chains = detect(s, d, 'repair-failures')
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({
      severity: 'major',
      headline: '2 repairs failed',
      rootDesignDecision: { field: 'crewIds', label: 'Crew recruited' },
    })
    expect(chains[0]!.suggestion).toBe(
      'Recruit a Practical crew member such as Jonas Reyes to lift repair odds.',
    )
  })

  it('spare kits are only blamed when the failed repair needed them', () => {
    // compress (data-overflow) uses no spare kits; spares ran out anyway.
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    s.resources.spareKits = 0
    snap(s, { turn: 2, day: 8 })
    s.decisions.push({
      turn: 3,
      day: 12,
      eventId: 'data-overflow',
      optionId: 'compress',
      crewId: 'priya-natarajan',
      success: false,
      chance: 0.82,
      crewEnergy: 90,
      handledBy: 'ai',
    })
    const chain = detect(s, MOON_GOOD_DESIGN, 'repair-failures')[0]!
    expect(chain.rootDesignDecision.label).toBe('Crew workload')
    expect(chain.steps.join(' ')).not.toMatch(/Spare kits ran out/)
  })

  it('morale collapse with two Leaders traces back to recruitment', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    snap(s, { turn: 1, day: 4 })
    for (const c of Object.values(s.turnHistory[0]!.crew)) c[1] = 30
    const chains = detect(s, MOON_GOOD_DESIGN, 'morale-collapse')
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({
      headline: 'Morale collapsed by day 8',
      rootDesignDecision: { field: 'crewIds' },
    })
    expect(chains[0]!.steps[1]).toMatch(/^Priya Natarajan and Theo Lindqvist are all Leaders/)
    expect(chains[0]!.suggestion).toBe(
      'Recruit only one Leader: swap Theo Lindqvist for a Thinker or Practical crew member.',
    )
  })

  it('EVA impossible: no suits packed when a panel needed an EVA repair', () => {
    const d = without(MOON_GOOD_DESIGN, 'eva-suit-pair')
    const s = initMission(d, content, 1)
    snap(s, { turn: 2, day: 8, eventIds: ['solar-panel-damage'] })
    const chains = detect(s, d, 'eva-impossible')
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({ rootDesignDecision: { label: 'EVA suits packed', value: 0 } })
    expect(chains[0]!.steps[0]).toBe(
      '1 event(s) needed someone outside but no suits were available (Solar Panel Damage).',
    )
  })

  it('positive chain: a 70% power margin absorbed solar panel damage', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    snap(s, { turn: 2, day: 8, eventIds: ['solar-panel-damage'] })
    const chains = detect(s, MOON_GOOD_DESIGN, 'power-margin-held')
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({
      severity: 'positive',
      headline: 'Your 70% power margin turned the Solar Panel Damage into a non-event',
    })
  })

  it('ranking: severity then impact, max 5, and at least one positive if any exist', () => {
    const mk = (id: string, severity: CauseChain['severity'], lost: number): CauseChain => ({
      id,
      severity,
      headline: id,
      steps: [],
      rootDesignDecision: { field: 'x', value: 0, label: 'x' },
      suggestion: '',
      impact: { scorePointsLost: lost },
    })
    const shown = selectCauses([
      mk('minor-a', 'minor', 9),
      mk('major-a', 'major', 2),
      mk('major-b', 'major', 8),
      mk('critical', 'critical', 50),
      mk('minor-b', 'minor', 1),
      mk('minor-c', 'minor', 3),
      mk('good-a', 'positive', 0),
      mk('good-b', 'positive', 0),
    ])
    expect(shown.map((c) => c.id)).toEqual(['critical', 'major-b', 'major-a', 'minor-a', 'good-a'])
  })
})

describe('score', () => {
  it('a failed mission totals at most 39, scores 0 stars and is "failed"', () => {
    const d: Design = {
      ...MOON_GOOD_DESIGN,
      supplies: { ...MOON_GOOD_DESIGN.supplies, foodKg: 10 },
    }
    const s = advanceTurn(initMission(d, quiet, 1), d, quiet, createRng(1)).state
    const score = computeScore(s, d, quiet)
    expect(score.outcome).toBe('failed')
    expect(score.total).toBeLessThanOrEqual(39)
    expect(score.stars).toBe(0)
  })

  it('a perfect mission gets 3 stars', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    s.turnIndex = s.totalTurns
    s.resources.sciencePoints = 200
    s.resources.scienceGb = 50
    for (const c of Object.values(s.crew)) c.morale = 100
    snap(s, { turn: 0, day: 0 })
    const score = computeScore(s, MOON_GOOD_DESIGN, content)
    // science 100, safety 100, efficiency ≈ 89.4, teamwork 100 -> 97.9 + 10 bonus -> 100
    expect(score.parts.science.score).toBe(100)
    expect(score.parts.safety.score).toBe(100)
    expect(score.stars).toBe(3)
    expect(score.outcome).toBe('success')
    expect(score.bonusObjectives.every((b) => b.achieved)).toBe(true)
  })

  it('data stuck in the backlog does not count as science', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    s.resources.sciencePoints = 40 // returned
    s.resources.pendingSciencePoints = 60 // still onboard
    s.resources.dataBacklogGb = 50
    const science = computeScore(s, MOON_GOOD_DESIGN, content).parts.science
    expect(science.score).toBe(40) // 40 ÷ 100 target
    expect(science.explanation).toBe(
      'Returned 40 of the 100 target science points to Earth; 50 GB stuck onboard and 0 GB lost did not count.',
    )
  })

  it('a health loss from an event breaks the "No crew injuries" bonus', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    s.changes.push({
      turn: 1,
      day: 4,
      resource: 'health:jonas-reyes',
      delta: -10,
      sourceType: 'event',
      sourceId: 'minor-injury',
      note: '',
    })
    const bonus = computeScore(s, MOON_GOOD_DESIGN, content).bonusObjectives.find(
      (b) => b.id === 'no-injuries',
    )!
    expect(bonus.achieved).toBe(false)
  })

  it('same history -> identical score and causes (determinism)', () => {
    const run = () =>
      autoRun(initMission(MARS_GOOD_DESIGN, content, 7), MARS_GOOD_DESIGN, content, createRng(7))
    const a = run()
    const b = run()
    expect(computeScore(a, MARS_GOOD_DESIGN, content)).toEqual(
      computeScore(b, MARS_GOOD_DESIGN, content),
    )
    expect(analyzeCauses(a, MARS_GOOD_DESIGN, content)).toEqual(
      analyzeCauses(b, MARS_GOOD_DESIGN, content),
    )
    const causes = analyzeCauses(a, MARS_GOOD_DESIGN, content)
    expect(causes.length).toBeGreaterThan(0)
    expect(causes.length).toBeLessThanOrEqual(5)
  })
})

describe('mission history', () => {
  it('records consumption changes and a compact snapshot each turn', () => {
    const s = advanceTurn(
      initMission(MOON_GOOD_DESIGN, quiet, 1),
      MOON_GOOD_DESIGN,
      quiet,
      createRng(1),
    ).state
    const o2 = s.changes.find((r) => r.resource === 'oxygenKg')!
    expect(o2).toMatchObject({
      turn: 0,
      day: 0,
      sourceType: 'consumption',
      sourceId: 'life-support',
    })
    expect(o2.delta).toBeCloseTo(-10.08, 6) // 4 × 0.84 × 3
    expect(s.turnHistory).toHaveLength(1)
    // energy capped at 100; morale 80 − 2 (two Leaders); health 100
    expect(s.turnHistory[0]!.crew['jonas-reyes']).toEqual([100, 78, 100])
  })

  it('records option consumption and the decision when an event is resolved', () => {
    const s0 = initMission(MOON_GOOD_DESIGN, content, 1)
    const event = content.events.find((e) => e.id === 'battery-fault')!
    const s = resolveEvent(s0, event, 'replace-cell', 'jonas-reyes', createRng(1), {
      design: MOON_GOOD_DESIGN,
      content,
    }).state
    expect(s.changes).toContainEqual(
      expect.objectContaining({
        resource: 'spareKits',
        delta: -1,
        sourceType: 'option',
        sourceId: 'battery-fault:replace-cell',
      }),
    )
    expect(s.decisions).toEqual([
      expect.objectContaining({
        eventId: 'battery-fault',
        optionId: 'replace-cell',
        crewId: 'jonas-reyes',
        crewEnergy: 100,
      }),
    ])
  })
})

describe('compareRuns', () => {
  it('detects a changed rocket and a changed supply amount, with score deltas', () => {
    const b: Design = {
      ...MOON_GOOD_DESIGN,
      rocketId: 'light-lunar-launcher',
      supplies: { ...MOON_GOOD_DESIGN.supplies, foodKg: 300 },
    }
    const sa = autoRun(
      initMission(MOON_GOOD_DESIGN, content, 3),
      MOON_GOOD_DESIGN,
      content,
      createRng(3),
    )
    const sb = autoRun(initMission(b, content, 3), b, content, createRng(3))
    const runA = { design: MOON_GOOD_DESIGN, score: computeScore(sa, MOON_GOOD_DESIGN, content) }
    const runB = { design: b, score: computeScore(sb, b, content) }
    const diff = compareRuns(runA, runB, content)
    expect(diff.designChanges).toEqual([
      {
        field: 'rocketId',
        label: 'Launcher',
        before: 'Medium Lunar Launcher',
        after: 'Light Lunar Launcher',
      },
      { field: 'supplies.foodKg', label: 'food packed (kg)', before: '270', after: '300' },
    ])
    expect(diff.scoreDeltas.total).toBe(runB.score.total - runA.score.total)
  })

  it('detects added and removed parts', () => {
    const b = {
      ...without(MOON_GOOD_DESIGN, 'spares-kit'),
      partIds: [...without(MOON_GOOD_DESIGN, 'spares-kit').partIds, 'rover-mini'],
    }
    const score = computeScore(initMission(MOON_GOOD_DESIGN, content, 1), MOON_GOOD_DESIGN, content)
    const diff = compareRuns({ design: MOON_GOOD_DESIGN, score }, { design: b, score }, content)
    expect(diff.designChanges).toEqual([
      { field: 'partIds', label: 'Critical Spares Kit', before: '1×', after: '0×' },
      { field: 'partIds', label: 'Unpressurised Mini Rover', before: '0×', after: '1×' },
    ])
  })
})
