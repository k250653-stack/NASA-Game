import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import type { GameEvent } from '@/schemas'
import { chooseResponse } from '../crewAI'
import { availableOptions, eventChance, resolveEvent, successChance } from '../events'
import { advanceTurn, dispatchEvent, initMission, isMissionOver } from '../mission'
import { crewMembers } from '../missionHelpers'
import { createRng } from '../rng'
import {
  MARS_BAD_DESIGN,
  MARS_GOOD_DESIGN,
  MOON_BAD_DESIGN,
  MOON_GOOD_DESIGN,
} from '../sampleDesigns'
import type { Design, EngineContent, MissionState } from '../types'

const content = loadContent()
/** Same content with no events, so turn arithmetic can be checked by hand. */
const quiet: EngineContent = { ...content, events: [] }
const ev = (id: string): GameEvent => content.events.find((e) => e.id === id)!
const ctxOf = (design: Design, c: EngineContent = content) => ({ design, content: c })

/** Plays a whole mission; the "player" answers pending events with the AI's choice. */
function play(
  design: Design,
  seed: number,
  c: EngineContent = content,
  onTurn?: (s: MissionState) => void,
) {
  const rng = createRng(seed)
  const ctx = ctxOf(design, c)
  const crew = crewMembers(ctx)
  let s = initMission(design, c, seed)
  let powerEvents = 0
  while (!isMissionOver(s)) {
    const r = advanceTurn(s, design, c, rng)
    s = r.state
    powerEvents += r.newEvents.filter((e) => e.weakness === 'power').length
    for (const p of [...s.pendingEvents]) {
      const e = c.events.find((x) => x.id === p.eventId)!
      const d = chooseResponse(s, e, crew, crew[0]!.priorities, design.standingOrders, ctx)
      if (d) s = resolveEvent(s, e, d.optionId, d.crewId, rng, ctx).state
    }
    onTurn?.(s)
  }
  return { state: s, powerEvents }
}

describe('determinism', () => {
  it('same seed + design + choices -> identical final state (Moon and Mars)', () => {
    expect(play(MOON_GOOD_DESIGN, 42).state).toEqual(play(MOON_GOOD_DESIGN, 42).state)
    expect(play(MARS_GOOD_DESIGN, 7).state).toEqual(play(MARS_GOOD_DESIGN, 7).state)
  })

  it('different seeds give different mission logs', () => {
    expect(play(MARS_GOOD_DESIGN, 1).state.eventLog).not.toEqual(
      play(MARS_GOOD_DESIGN, 2).state.eventLog,
    )
  })
})

describe('invariants over many seeded runs', () => {
  it('resources never go negative and crew stats stay in 0-100', () => {
    for (const design of [MOON_GOOD_DESIGN, MOON_BAD_DESIGN, MARS_GOOD_DESIGN, MARS_BAD_DESIGN]) {
      for (let seed = 1; seed <= 25; seed++) {
        play(design, seed, content, (s) => {
          for (const [k, v] of Object.entries(s.resources)) {
            if (k !== 'power') expect(v, `${k} seed ${seed}`).toBeGreaterThanOrEqual(0)
          }
          for (const c of Object.values(s.crew)) {
            for (const v of [c.energy, c.morale, c.health]) {
              expect(v).toBeGreaterThanOrEqual(0)
              expect(v).toBeLessThanOrEqual(100)
            }
          }
        })
      }
    }
  }, 30_000) // 100 full missions

  it('advanceTurn after the mission is over returns the same state', () => {
    const { state } = play(MOON_GOOD_DESIGN, 3)
    expect(advanceTurn(state, MOON_GOOD_DESIGN, content, createRng(1)).state).toBe(state)
  })
})

describe('turn arithmetic (no events)', () => {
  it('initMission: supplies as packed, battery full (250,000 Wh), 2 suits, crew rested', () => {
    const s = initMission(MOON_GOOD_DESIGN, quiet, 1)
    expect(s.resources).toMatchObject({
      batteryWh: 250000,
      waterKg: 100,
      foodKg: 270,
      oxygenKg: 130,
      suits: 2,
      spareKits: 1,
    })
    expect(s.totalTurns).toBe(9)
    expect(s.crew['bilal']).toEqual({ energy: 100, morale: 80, health: 100, busyTurns: 0 })
  })

  it('Moon turn 1 (3-day coast): O2 −10.08, food −21.6, water −3.6 (90% recycled)', () => {
    // O2 4 × 0.84 × 3 = 10.08; food 4 × 1.8 × 3 = 21.6; water 4 × 3.0 × 3 × 0.1 = 3.6
    // Power in transit: 10 kW × 1.0 × 1.0 light = 10,000 W − (1,500 + 80 + 400) W = +8,020 W
    const s = advanceTurn(
      initMission(MOON_GOOD_DESIGN, quiet, 1),
      MOON_GOOD_DESIGN,
      quiet,
      createRng(1),
    ).state
    expect(s.resources.oxygenKg).toBeCloseTo(119.92, 6)
    expect(s.resources.foodKg).toBeCloseTo(248.4, 6)
    expect(s.resources.waterKg).toBeCloseTo(96.4, 6) // 100 − 3.6
    expect(s.resources.power).toBeCloseTo(8020, 6)
    expect(s).toMatchObject({ day: 3, turnIndex: 1, phaseId: 'surface', location: 'surface' })
  })

  it('Moon turn 2 (4 surface days): drill 4 × 4 = 16 points, 2 × 4 = 8 GB sent home', () => {
    const rng = createRng(1)
    let s = initMission(MOON_GOOD_DESIGN, quiet, 1)
    s = advanceTurn(s, MOON_GOOD_DESIGN, quiet, rng).state
    expect(s.resources.sciencePoints).toBe(0) // the drill does nothing in transit
    s = advanceTurn(s, MOON_GOOD_DESIGN, quiet, rng).state
    expect(s.resources.sciencePoints).toBe(16)
    expect(s.resources.scienceGb).toBe(8)
    expect(s.resources.dataBacklogGb).toBe(0)
  })

  it('supplies run out -> failed with a readable reason (10 kg food: 10 ÷ 7.2/day = day 1)', () => {
    const d = { ...MOON_GOOD_DESIGN, supplies: { ...MOON_GOOD_DESIGN.supplies, foodKg: 10 } }
    const s = advanceTurn(initMission(d, quiet, 1), d, quiet, createRng(1)).state
    expect(s.outcome).toBe('failed')
    expect(s.failReason).toBe('Food ran out on day 1 during Trans-lunar coast.')
    expect(s.resources.foodKg).toBe(0)
  })

  it('no solar: battery drains, science is shed, then degraded life support runs out of water', () => {
    // Turn 1: 1,980 W × 72 h = 142,560 Wh -> 107,440 Wh left.
    // Turn 2: 2,100 W × 96 h = 201,600 Wh; shedding the drill saves 120 × 96 = 11,520; still short
    // -> degraded: no recycling, water 4 × 3 × 4 = 48 kg vs 46.4 kg -> runs out on day 3 + 3 = 6.
    const d = {
      ...MOON_GOOD_DESIGN,
      partIds: MOON_GOOD_DESIGN.partIds.filter((id) => id !== 'solar-array-roll-10kw'),
      supplies: { ...MOON_GOOD_DESIGN.supplies, waterKg: 50 }, // 50 − 3.6 = 46.4 after turn 1
    }
    const rng = createRng(1)
    let s = advanceTurn(initMission(d, quiet, 1), d, quiet, rng).state
    expect(s.resources.batteryWh).toBeCloseTo(107440, 6)
    s = advanceTurn(s, d, quiet, rng).state
    const text = s.eventLog.map((l) => l.text).join('\n')
    expect(text).toMatch(/120 W of science instruments switched off/)
    expect(text).toMatch(/Power shortfall/)
    expect(s.failReason).toBe('Water ran out on day 6 during Surface operations.')
  })

  it('standing order abort_early cuts the surface stay and jumps to the return phase', () => {
    // 200 kg food lasts 200 ÷ 7.2 = 27.8 days < 34. Transit turn rations; first surface turn aborts.
    const d: Design = {
      ...MOON_GOOD_DESIGN,
      supplies: { ...MOON_GOOD_DESIGN.supplies, foodKg: 200 },
      standingOrders: { ...MOON_GOOD_DESIGN.standingOrders, lowSupplies: 'abort_early' },
    }
    const rng = createRng(1)
    let s = advanceTurn(initMission(d, quiet, 1), d, quiet, rng).state
    expect(s.resources.foodKg).toBeCloseTo(200 - 21.6 * 0.75, 6) // rationed in transit
    s = advanceTurn(s, d, quiet, rng).state
    expect(s.abortedEarly).toBe(true)
    expect(s.turnIndex).toBe(8)
    expect(s.phaseId).toBe('return')
  })
})

describe('options and resolution', () => {
  it('unavailable options cannot be chosen: no suits -> EVA repair refused, state unchanged', () => {
    const s0 = initMission(MOON_GOOD_DESIGN, content, 1)
    const s = { ...s0, resources: { ...s0.resources, suits: 0 } }
    const opts = availableOptions(s, ev('solar-panel-damage'), MOON_GOOD_DESIGN, content)
    expect(opts.find((o) => o.option.id === 'eva-repair')).toMatchObject({
      available: false,
      reason: 'No suits left',
    })
    const r = resolveEvent(
      s,
      ev('solar-panel-damage'),
      'eva-repair',
      'bilal',
      createRng(1),
      ctxOf(MOON_GOOD_DESIGN),
    )
    expect(r.result.applied).toBe(false)
    expect(r.state).toBe(s)
  })

  it('no spare kits -> replacing a battery module is unavailable', () => {
    const s0 = initMission(MOON_GOOD_DESIGN, content, 1)
    const s = { ...s0, resources: { ...s0.resources, spareKits: 0 } }
    const opt = availableOptions(s, ev('battery-fault'), MOON_GOOD_DESIGN, content).find(
      (o) => o.option.id === 'replace-cell',
    )
    expect(opt).toMatchObject({ available: false, reason: 'No spare kits left' })
  })

  it('success chance is clamped to 5%-95%', () => {
    const ctx = ctxOf(MOON_GOOD_DESIGN)
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    const jonas = content.crew.find((c) => c.id === 'bilal')!
    const e = ev('battery-fault')
    const option = e.options.find((o) => o.id === 'replace-cell')!
    // 0.7 + power 5 × 0.06 + practical 0.1 = 1.1 -> 0.95
    expect(successChance(s, e, option, jonas, ctx)).toBe(0.95)
    expect(successChance(s, e, { ...option, baseSuccess: 0 }, null, ctx)).toBe(0.05)
  })

  it('a resolved choice spends what it consumes and is logged', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    s.pendingEvents.push({ uid: 'battery-fault@0', eventId: 'battery-fault', turnIndex: 0, day: 0 })
    const r = resolveEvent(
      s,
      ev('battery-fault'),
      'replace-cell',
      'bilal',
      createRng(1),
      ctxOf(MOON_GOOD_DESIGN),
    )
    expect(r.result.applied).toBe(true)
    expect(r.state.resources.spareKits).toBe(0)
    expect(r.state.crew['bilal']).toMatchObject({ energy: 80, busyTurns: 1 })
    expect(r.state.pendingEvents).toEqual([])
    expect(r.state.eventLog.at(-1)?.text).toMatch(/^Bilal Ahmed chose "Swap in a spare module"/)
  })
})

describe('crew AI', () => {
  it('picks the Practical crew member with the higher skill for a repair', () => {
    const ctx = ctxOf(MOON_GOOD_DESIGN)
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    const pool = content.crew.filter((c) => c.id === 'ayesha' || c.id === 'bilal')
    const d = chooseResponse(
      s,
      ev('battery-fault'),
      pool,
      pool[1]!.priorities,
      MOON_GOOD_DESIGN.standingOrders,
      ctx,
    )!
    // Bilal: power 5 + practical; Ayesha: power 1, thinker.
    expect(d).toMatchObject({ optionId: 'replace-cell', crewId: 'bilal' })
    expect(d.reason).toBe(
      'Bilal Ahmed took "Swap in a spare module": highest power skill (5/5), well rested, 95% chance.',
    )
  })

  it('standing order eva "never" rules out EVA options', () => {
    const d: Design = {
      ...MOON_GOOD_DESIGN,
      standingOrders: { ...MOON_GOOD_DESIGN.standingOrders, eva: 'never' },
    }
    const s = initMission(d, content, 1)
    const crew = crewMembers(ctxOf(d))
    expect(
      chooseResponse(
        s,
        ev('solar-panel-damage'),
        crew,
        crew[1]!.priorities,
        d.standingOrders,
        ctxOf(d),
      )?.optionId,
    ).toBe('accept-loss')
  })
})

describe('event routing and delayed comms', () => {
  it('Mars urgent event for the player is handled by crew under standing orders (delay > 60 s)', () => {
    const s = { ...initMission(MARS_GOOD_DESIGN, content, 1), day: 300 }
    const after = dispatchEvent(s, ev('battery-fault'), ctxOf(MARS_GOOD_DESIGN), createRng(1))
    expect(after.pendingEvents).toEqual([])
    const entry = after.eventLog.at(-1)!
    expect(entry.handledBy).toBe('standing-orders')
    expect(entry.text).toMatch(
      /^Handled by crew \(signal delay \d+(\.\d)? min\) under standing orders\./,
    )
  })

  it('Moon urgent event for the player stays pending (live response)', () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1)
    const after = dispatchEvent(s, ev('battery-fault'), ctxOf(MOON_GOOD_DESIGN), createRng(1))
    expect(after.pendingEvents.map((p) => p.eventId)).toEqual(['battery-fault'])
  })

  it('Mars routine event for the player stays pending even with signal delay', () => {
    const d: Design = { ...MARS_GOOD_DESIGN, playerRole: 'comms_nav' }
    const s = initMission(d, content, 1)
    expect(dispatchEvent(s, ev('comms-outage'), ctxOf(d), createRng(1)).pendingEvents).toHaveLength(
      1,
    )
  })

  it("another role's event is auto-resolved by that role's AI owner, with the reason logged", () => {
    const s = initMission(MOON_GOOD_DESIGN, content, 1) // player flies power_life
    const after = dispatchEvent(s, ev('instrument-jam'), ctxOf(MOON_GOOD_DESIGN), createRng(1))
    const entry = after.eventLog.at(-1)!
    expect(entry.handledBy).toBe('ai')
    expect(entry.text).toMatch(
      /^Ayesha Khan \(Science\) handled "Instrument Jam"\. Ayesha Khan took/,
    )
  })
})

describe('part failures', () => {
  it('recycler failure chance comes from the parts: 1 − (1 − 0.03)(1 − 0.03) = 5.91% on Mars', () => {
    const s = initMission(MARS_GOOD_DESIGN, content, 1)
    // eclss-advanced 0.03 and oxygen-generator 0.03 per turn
    expect(eventChance(ev('recycler-failure'), s, ctxOf(MARS_GOOD_DESIGN))).toBeCloseTo(0.0591, 6)
    // Moon: eclss-core 0.02 only
    const m = initMission(MOON_GOOD_DESIGN, content, 1)
    expect(eventChance(ev('recycler-failure'), m, ctxOf(MOON_GOOD_DESIGN))).toBeCloseTo(0.02, 6)
  })
})

describe('design weaknesses', () => {
  it('a low power margin design gets more power events over 100 seeded runs', () => {
    // 5 kW rigid array: 5,000 × 0.7 = 3,500 W vs 2,100 + 800 (lab) = 2,900 W -> margin 17% < 20%.
    const weak: Design = {
      ...MOON_GOOD_DESIGN,
      partIds: [
        ...MOON_GOOD_DESIGN.partIds.filter((id) => id !== 'solar-array-roll-10kw'),
        'solar-array-5kw',
        'sample-lab',
      ],
    }
    expect(initMission(weak, content, 1).weaknesses).toContain('power')
    expect(initMission(MOON_GOOD_DESIGN, content, 1).weaknesses).not.toContain('power')
    let weakCount = 0
    let strongCount = 0
    for (let seed = 1; seed <= 100; seed++) {
      weakCount += play(weak, seed).powerEvents
      strongCount += play(MOON_GOOD_DESIGN, seed).powerEvents
    }
    expect(weakCount).toBeGreaterThan(strongCount * 1.4)
  })
})
