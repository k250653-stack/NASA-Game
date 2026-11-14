/**
 * Direct tests for exported engine helpers that were previously only covered through their
 * callers (audit, Prompt 8 Part A2). Expected values are worked out by hand in comments.
 */
import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import type { GameEvent } from '@/schemas'
import { answerPendingWithAi, autoRun } from '../autopilot'
import {
  detectDataLoss,
  detectEvaImpossible,
  detectMoraleCollapse,
  detectPowerShortfall,
  detectRepairFailures,
  detectSupplyRunOut,
} from '../causeDetectors'
import {
  detectBalancedTeam,
  detectDataAllHome,
  detectPowerMarginHeld,
  detectRecyclingSaved,
} from '../causePositives'
import { analyzeCauses, buildCauseContext, sortCauses, type CauseChain } from '../causes'
import { eventOwner, optionScore } from '../crewAI'
import { difficultyModifiers } from '../difficulty'
import { applyEffect } from '../effects'
import { conditionMet, eligibleCrew, eligibleEvents, rollEvents } from '../events'
import { fmt, fmtPct } from '../format'
import { recordChange, recordSnapshot } from '../history'
import { initMission } from '../mission'
import {
  activeParts,
  averageMorale,
  batteryCapacityWh,
  bestStat,
  clamp,
  cloneState,
  crewName,
  designParts,
  modifier,
  sumStat,
  teamModifiers,
} from '../missionHelpers'
import {
  applyChanges,
  baseDesign,
  BALANCED,
  crewPriorities,
  isPlayerRole,
  massRatio,
  ownerOfCategory,
  ownerOfChange,
  sizeSupplies,
  supplyKgPerDay,
  type ProposalInput,
} from '../planning'
import { launchReadiness, supplyReadout } from '../planningHints'
import { rocketFits, tradeOptions } from '../planningOptions'
import { sizePower } from '../proposal'
import { candidates, playerRoleOf } from '../recruitment'
import { createRng } from '../rng'
import { MARS_GOOD_DESIGN, MOON_BAD_DESIGN, MOON_GOOD_DESIGN } from '../sampleDesigns'
import { bandScore, computeScore, missionFacts } from '../score'
import { supplyFeasibilityCheck } from '../supplyFeasibility'
import { missionTimeline, partWorksAt } from '../timeline'
import { computeTotals } from '../budget'

const content = loadContent()
const ctx = { design: MOON_GOOD_DESIGN, content }
const ev = (id: string): GameEvent => content.events.find((e) => e.id === id)!
const moon = content.destinations.find((d) => d.id === 'moon')!
const moonScenario = content.scenarios.find((s) => s.id === 'shackleton-ice-hunt')!
const input = (seat: ProposalInput['seat'] = 'science'): ProposalInput => ({
  scenario: moonScenario,
  destination: moon,
  crew: ['sana', 'kofi', 'omar'].map((id) => content.crew.find((m) => m.id === id)!),
  seat,
  difficulty: 'engineer',
})

describe('format', () => {
  it('fmt and fmtPct', () => {
    expect(fmt(2340)).toBe('2,340')
    expect(fmt(31.94, 1)).toBe('31.9')
    expect(fmt(Number.POSITIVE_INFINITY)).toBe('unlimited')
    expect(fmtPct(0.234)).toBe('23%')
  })
})

describe('mission helpers', () => {
  const s = initMission(MOON_GOOD_DESIGN, content, 1)

  it('clamp, sums and best stats', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    // 200,000 fuel cell + 50,000 pack = 250,000 Wh; best water recovery 0.9
    expect(sumStat(designParts(ctx), 'capacityWh')).toBe(250000)
    expect(bestStat(designParts(ctx), 'waterRecoveryRate')).toBe(0.9)
  })

  it('disabled parts drop out of active parts and battery capacity', () => {
    const t = { ...cloneState(s), disabledParts: { 'regen-fuel-cell-200kwh': 2 } }
    expect(activeParts(t, ctx).map((p) => p.id)).not.toContain('regen-fuel-cell-200kwh')
    expect(batteryCapacityWh(t, ctx)).toBe(50000)
  })

  it('modifiers multiply; morale averages; names and team modifiers resolve', () => {
    const t = cloneState(s)
    t.activeEffects = [
      { target: 'solarOutput', value: 0.5, turnsLeft: 1, sourceEventId: 'x' },
      { target: 'solarOutput', value: 0.8, turnsLeft: 2, sourceEventId: 'y' },
    ]
    expect(modifier(t, 'solarOutput')).toBeCloseTo(0.4, 10)
    expect(modifier(t, 'dataRate')).toBe(1)
    expect(averageMorale(s)).toBe(80)
    expect(crewName(ctx, 'bilal')).toBe('Bilal Ahmed')
    expect(teamModifiers(ctx).moraleDrift).toBe(-2) // Lin and Kofi are both Leaders
  })

  it('cloneState is a deep copy', () => {
    const t = cloneState(s)
    t.resources.waterKg = 0
    expect(s.resources.waterKg).toBe(100)
  })
})

describe('history and effects', () => {
  it('recordChange skips zero deltas; recordSnapshot keeps rounded numbers', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    recordChange(s, 'waterKg', 0, 'consumption', 'x', '')
    recordChange(s, 'waterKg', -1.5, 'consumption', 'x', '')
    expect(s.changes).toHaveLength(1)
    recordSnapshot(
      s,
      { turnIndex: 0, startDay: 0, days: 3, phaseId: 'outbound', location: 'transit' },
      ['comms-outage'],
      {
        dataLostGb: 0,
        batteryEmpty: false,
        scienceShed: false,
        lifeSupportDegraded: false,
        rationing: false,
      },
    )
    expect(s.turnHistory[0]).toMatchObject({ turn: 0, days: 3, eventIds: ['comms-outage'] })
  })

  it('applyEffect clamps resources at 0 and crew stats at 100, and queues modifiers', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    const rng = createRng(1)
    applyEffect(s, { target: 'oxygenKg', op: 'add', value: -1000 }, ctx, rng, null, 'e')
    applyEffect(s, { target: 'allCrew', stat: 'morale', op: 'add', value: 50 }, ctx, rng, null, 'e')
    applyEffect(
      s,
      { target: 'scienceRate', op: 'multiply', value: 0.5, durationTurns: 2 },
      ctx,
      rng,
      null,
      'e',
    )
    expect(s.resources.oxygenKg).toBe(0)
    expect(Object.values(s.crew).every((c) => c.morale === 100)).toBe(true)
    expect(s.activeEffects).toEqual([
      { target: 'scienceRate', value: 0.5, turnsLeft: 2, sourceEventId: 'e' },
    ])
  })
})

describe('events', () => {
  const s = initMission(MOON_GOOD_DESIGN, content, 1)
  const turns = missionTimeline(moon)

  it('conditionMet: dayAfter, noSpares, leadersAtLeast', () => {
    expect(conditionMet({ key: 'dayAfter', value: 10 }, { ...s, day: 11 }, ctx)).toBe(true)
    expect(conditionMet({ key: 'noSpares' }, s, ctx)).toBe(false)
    expect(conditionMet({ key: 'leadersAtLeast', value: 2 }, s, ctx)).toBe(true)
  })

  it('eligibleEvents: Mars-only and surface-only events are filtered out on the Moon transit', () => {
    const ids = eligibleEvents(s, ctx, turns[0]!).map((e) => e.id)
    expect(ids).not.toContain('dust-storm') // Mars only
    expect(ids).not.toContain('solar-panel-damage') // surface only
    expect(ids).toContain('battery-fault')
  })

  it('rollEvents never fires more than maxEventsPerTurn (2)', () => {
    const always = {
      ...content,
      events: content.events.map((e) => ({ ...e, trigger: { ...e.trigger, chance: 1 } })),
    }
    expect(
      rollEvents(s, { design: MOON_GOOD_DESIGN, content: always }, turns[1]!, createRng(1)).length,
    ).toBe(2)
  })

  it('eligibleCrew excludes busy and tired crew', () => {
    const option = ev('battery-fault').options.find((o) => o.id === 'replace-cell')!
    const t = cloneState(s)
    t.crew['bilal']!.busyTurns = 1
    t.crew['lin']!.energy = 10 // needs 20
    expect(eligibleCrew(t, option, ctx).map((m) => m.id)).toEqual(['ayesha', 'kofi'])
  })
})

describe('crew AI and autopilot', () => {
  const s = initMission(MOON_GOOD_DESIGN, content, 1)

  it('eventOwner is the crew member with the event role', () => {
    expect(eventOwner(s, ev('instrument-jam'), content.crew)?.id).toBe('ayesha')
  })

  it('optionScore prefers keeping the battery to losing 40% of it', () => {
    const e = ev('battery-fault')
    const p = content.crew.find((m) => m.id === 'bilal')!.priorities
    expect(optionScore(e.options[0]!, 0.95, p, s)).toBeGreaterThan(
      optionScore(e.options[1]!, 1, p, s),
    )
  })

  it('answerPendingWithAi clears pending events and logs the choice', () => {
    const t = cloneState(s)
    t.pendingEvents.push({ uid: 'u', eventId: 'comms-outage', turnIndex: 0, day: 0 })
    const after = answerPendingWithAi(t, MOON_GOOD_DESIGN, content, createRng(2))
    expect(after.pendingEvents).toEqual([])
    expect(after.decisions).toHaveLength(1)
  })
})

describe('planning helpers', () => {
  it('ownership lookups', () => {
    expect(ownerOfCategory('rover', content)).toBe('science')
    expect(ownerOfChange({ kind: 'rocket', rocketId: 'x' }, content)).toBe('launch_budget')
    expect(ownerOfChange({ kind: 'supply', resource: 'foodKg', deltaKg: 1 }, content)).toBe(
      'power_life',
    )
  })

  it('applyChanges applies in order', () => {
    const d = applyChanges(MOON_GOOD_DESIGN, [
      { kind: 'addPart', partId: 'rover-mini' },
      { kind: 'swapPart', fromId: 'rover-mini', toId: 'rover-pressurized' },
    ])
    expect(d.partIds.at(-1)).toBe('rover-pressurized')
  })

  it('supplyKgPerDay and massRatio', () => {
    expect(supplyKgPerDay(MOON_GOOD_DESIGN, 'waterKg', content)).toBeCloseTo(1.2, 10) // 4 × 3.0 × 0.1
    expect(massRatio(MOON_GOOD_DESIGN, content, moon)).toBeCloseTo(4270 / 8000, 10)
  })

  it('crew priorities: the player seat is balanced, AI seats use their own', () => {
    expect(crewPriorities(input(), 'science')).toEqual(BALANCED)
    expect(crewPriorities(input(), 'launch_budget')).toEqual(
      content.crew.find((m) => m.id === 'kofi')!.priorities,
    )
    expect(isPlayerRole(input(), 'science')).toBe(true)
    expect(isPlayerRole(input('director'), 'comms_nav')).toBe(true)
  })

  it('baseDesign puts the player character first', () => {
    expect(baseDesign(input()).crewIds).toEqual(['player-science', 'sana', 'kofi', 'omar'])
  })

  it('sizeSupplies: 37 days for 4 crew with 90% water recycling, balanced buffer', () => {
    // water 4 × 37 × 3.0 × 0.1 = 44.4 + outage 4 × 3.0 × 4-day turn × 0.33 = 15.84 -> 61
    // oxygen 4 × 37 × 0.84 = 124.32 -> 125; food 4 × 37 × 1.8 = 266.4 -> 267
    expect(sizeSupplies(MOON_GOOD_DESIGN, input(), BALANCED, content)).toEqual({
      waterKg: 61,
      foodKg: 267,
      oxygenKg: 125,
    })
  })

  it('sizePower: 2,100 W load -> one 10 kW roll-out array, 2 fuel cells for the 100 h night', () => {
    // 2,100 × 1.3 = 2,730 W ≤ 10,000 × 0.7; night 2,100 × 100 × 1.066 = 223,860 Wh -> 2 × 200,000
    const d = sizePower(MOON_GOOD_DESIGN, input(), content, BALANCED)
    const count = (id: string) => d.partIds.filter((x) => x === id).length
    expect(count('solar-array-roll-10kw')).toBe(1)
    expect(count('regen-fuel-cell-200kwh')).toBe(2)
    expect(count('battery-li-50kwh')).toBe(0)
  })
})

describe('planning read-outs', () => {
  it('launchReadiness and supplyReadout', () => {
    expect(launchReadiness(MOON_GOOD_DESIGN, content)).toMatchObject({
      level: 'green',
      fails: 0,
      canLaunch: true,
    })
    expect(launchReadiness(MOON_BAD_DESIGN, content)).toMatchObject({
      level: 'red',
      fails: 3,
      canLaunch: false,
    })
    expect(supplyReadout(MOON_GOOD_DESIGN, content)).toMatchObject({
      limiting: 'food',
      missionDays: 34,
      requiredDays: 37,
    })
  })

  it('tradeOptions: Launch & Budget can only offer rockets; Power & Life offers supplies', () => {
    expect(
      tradeOptions(MOON_GOOD_DESIGN, 'launch_budget', content).every(
        (o) => o.change.kind === 'rocket',
      ),
    ).toBe(true)
    expect(
      tradeOptions(MOON_GOOD_DESIGN, 'power_life', content).some((o) => o.change.kind === 'supply'),
    ).toBe(true)
  })

  it('rocketFits: 4,270 kg is over the Light (3,000) and fine on the Medium (8,000)', () => {
    const fits = Object.fromEntries(
      rocketFits(MOON_GOOD_DESIGN, content).map((f) => [f.rocketId, f.status]),
    )
    expect(fits).toMatchObject({ 'light-lunar-launcher': 'fail', 'medium-lunar-launcher': 'ok' })
  })
})

describe('recruitment, timeline, feasibility, score helpers', () => {
  it('playerRoleOf and candidates', () => {
    expect(playerRoleOf('director')).toBeNull()
    expect(playerRoleOf('comms_nav')).toBe('comms_nav')
    expect(candidates(content).some((m) => m.isPlayer)).toBe(false)
  })

  it('partWorksAt: surface instruments idle in transit', () => {
    const drill = content.parts.find((p) => p.id === 'ice-drill-spectrometer')!
    expect(partWorksAt(drill, 'transit')).toBe(false)
    expect(partWorksAt(drill, 'surface')).toBe(true)
  })

  it('supplyFeasibilityCheck with no crew is ok', () => {
    const t = { ...computeTotals(MOON_GOOD_DESIGN, content), crewCount: 0 }
    expect(supplyFeasibilityCheck(t, 34, content.constants.perCrewPerDay, 8000, 'X').status).toBe(
      'ok',
    )
  })

  it('bandScore: 0 when negative, ramps below the band, 100 inside, 50 at full margin', () => {
    const band = { min: 0.05, max: 0.25 }
    expect(bandScore(-0.1, band)).toBe(0)
    expect(bandScore(0.025, band)).toBe(80) // 60 + 40 × 0.5
    expect(bandScore(0.1, band)).toBe(100)
    expect(bandScore(0.625, band)).toBe(75) // 100 − 50 × 0.375 ÷ 0.75
    expect(bandScore(1, band)).toBe(50)
  })

  it('missionFacts on a fresh state', () => {
    expect(missionFacts(initMission(MOON_GOOD_DESIGN, content, 1))).toMatchObject({
      dataLostGb: 0,
      injuries: 0,
      dead: 0,
      avgHealth: 100,
    })
  })

  it('difficultyModifiers', () => {
    expect(difficultyModifiers('engineer', content)).toMatchObject({
      budgetMultiplier: 1,
      eventChanceMultiplier: 1,
    })
  })
})

describe('cause detectors called directly', () => {
  it('a clean fresh mission triggers no problem detector', () => {
    const c = buildCauseContext(
      initMission(MOON_GOOD_DESIGN, content, 1),
      MOON_GOOD_DESIGN,
      content,
    )
    for (const d of [
      detectSupplyRunOut,
      detectPowerShortfall,
      detectDataLoss,
      detectRepairFailures,
      detectMoraleCollapse,
      detectEvaImpossible,
    ]) {
      expect(d(c)).toBeNull()
    }
    // Positives that need history (power event, data home) stay quiet; recycling and team ones may not.
    expect(detectPowerMarginHeld(c)).toBeNull()
    expect(detectDataAllHome(c)).toBeNull()
    expect(detectBalancedTeam(c)).toBeNull() // two Leaders
    expect(detectRecyclingSaved(c)).toBeNull() // day 0: nothing saved yet
  })

  it('sortCauses: severity then impact', () => {
    const mk = (id: string, severity: CauseChain['severity'], lost: number): CauseChain => ({
      id,
      severity,
      headline: id,
      steps: [],
      rootDesignDecision: { field: 'x', value: 0, label: 'x' },
      suggestion: '',
      impact: { scorePointsLost: lost },
    })
    expect(
      sortCauses([mk('a', 'minor', 9), mk('b', 'critical', 1), mk('c', 'minor', 20)]).map(
        (c) => c.id,
      ),
    ).toEqual(['b', 'c', 'a'])
  })
})

describe('determinism of full runs', () => {
  it('Moon and Mars auto-runs with a fixed seed give identical state, score and causes', () => {
    for (const design of [MOON_GOOD_DESIGN, MARS_GOOD_DESIGN]) {
      const run = () =>
        autoRun(initMission(design, content, 2026), design, content, createRng(2026))
      const a = run()
      const b = run()
      expect(b).toEqual(a)
      expect(computeScore(b, design, content)).toEqual(computeScore(a, design, content))
      expect(analyzeCauses(b, design, content)).toEqual(analyzeCauses(a, design, content))
    }
  })
})
