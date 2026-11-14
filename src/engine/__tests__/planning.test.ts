import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import type { RoleChoice } from '@/schemas'
import { computeTotals, rocketCapacityKg } from '../budget'
import { suggestTeam } from '../crewAI'
import { effectiveBudgetM } from '../difficulty'
import { runLaunchCheck } from '../launchCheck'
import {
  applyChange,
  canEdit,
  editDesign,
  proposeInitialDesign,
  supplyDaysToKg,
  supplyKgToDays,
} from '../planning'
import { planningGauges, roleUsage, suggestFixes } from '../planningHints'
import { createRng } from '../rng'
import { MOON_GOOD_DESIGN } from '../sampleDesigns'
import { evaluateTrade, type Trade } from '../trades'
import type { Design } from '../types'

const content = loadContent()
const crewById = (id: string) => content.crew.find((m) => m.id === id)!

function propose(
  scenarioId: string,
  seat: RoleChoice,
  difficulty: 'cadet' | 'engineer',
  seed = 42,
): Design {
  const scenario = content.scenarios.find((s) => s.id === scenarioId)!
  const destination = content.destinations.find((d) => d.id === scenario.destinationId)!
  const crew = suggestTeam({ scenarioId, difficulty, roleChoice: seat, crewIds: [] }, content)!.map(
    crewById,
  )
  return proposeInitialDesign(
    { scenario, destination, crew, seat, difficulty },
    content,
    createRng(seed),
  )
}

function ratios(d: Design) {
  const t = computeTotals(d, content)
  const scenario = content.scenarios.find((s) => s.id === d.scenarioId)!
  const destination = content.destinations.find((x) => x.id === d.destinationId)!
  const rocket = content.rockets.find((r) => r.id === d.rocketId) ?? null
  return {
    mass: t.massKg / rocketCapacityKg(rocket, destination),
    budget: t.costM / effectiveBudgetM(scenario, d.difficulty, content),
  }
}

const AI_SEATS = ['science', 'power_life', 'comms_nav', 'launch_budget'] as const
const SCENARIOS = ['shackleton-ice-hunt', 'jezero-long-stay'] as const

describe('ownership', () => {
  it('each seat edits only its own items; the Mission Director edits everything', () => {
    expect(canEdit('science', { kind: 'addPart', partId: 'sample-lab' }, content)).toBe(true)
    expect(canEdit('science', { kind: 'addPart', partId: 'battery-li-50kwh' }, content)).toBe(false)
    expect(
      canEdit('power_life', { kind: 'supply', resource: 'waterKg', deltaKg: 10 }, content),
    ).toBe(true)
    expect(
      canEdit('comms_nav', { kind: 'rocket', rocketId: 'heavy-lunar-launcher' }, content),
    ).toBe(false)
    expect(
      canEdit('launch_budget', { kind: 'rocket', rocketId: 'heavy-lunar-launcher' }, content),
    ).toBe(true)
    expect(canEdit('director', { kind: 'addPart', partId: 'battery-li-50kwh' }, content)).toBe(true)
  })

  it('editDesign refuses with the owning seat named, and leaves the design unchanged', () => {
    const r = editDesign(
      MOON_GOOD_DESIGN,
      'comms_nav',
      { kind: 'addPart', partId: 'rover-mini' },
      content,
    )
    expect(r.refused).toBe('That belongs to the Science Lead seat.')
    expect(r.design).toBe(MOON_GOOD_DESIGN)
  })

  it('a swap into another seat’s category is not allowed', () => {
    expect(
      canEdit(
        'science',
        { kind: 'swapPart', fromId: 'ice-drill-spectrometer', toId: 'battery-li-50kwh' },
        content,
      ),
    ).toBe(false)
  })

  it('supplies never go below zero', () => {
    const d = applyChange(MOON_GOOD_DESIGN, {
      kind: 'supply',
      resource: 'foodKg',
      deltaKg: -10_000,
    })
    expect(d.supplies.foodKg).toBe(0)
  })
})

describe('first proposal', () => {
  it('Engineer: every seat with AI teammates starts 5–20% over the rocket capacity', () => {
    for (const scenarioId of SCENARIOS) {
      for (const seat of AI_SEATS) {
        const r = ratios(propose(scenarioId, seat, 'engineer'))
        expect(r.mass, `${scenarioId} ${seat}`).toBeGreaterThanOrEqual(1.05)
        expect(r.mass, `${scenarioId} ${seat}`).toBeLessThanOrEqual(1.2)
      }
    }
  })

  it('Cadet: the proposal fits both the rocket and the budget', () => {
    for (const scenarioId of SCENARIOS) {
      for (const seat of [...AI_SEATS, 'director'] as const) {
        const r = ratios(propose(scenarioId, seat, 'cadet'))
        expect(r.mass, `${scenarioId} ${seat}`).toBeLessThanOrEqual(1)
        expect(r.budget, `${scenarioId} ${seat}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('the player character takes the player seat; standing orders come from the scenario', () => {
    const d = propose('jezero-long-stay', 'comms_nav', 'engineer')
    expect(d.crewIds[0]).toBe('player-comms-nav')
    expect(d.crewIds).toHaveLength(4)
    expect(d.playerRole).toBe('comms_nav')
    expect(d.standingOrders.eva).toBe('only_practical')
  })

  it('is deterministic for the same seed', () => {
    expect(propose('shackleton-ice-hunt', 'science', 'engineer', 7)).toEqual(
      propose('shackleton-ice-hunt', 'science', 'engineer', 7),
    )
  })
})

describe('trades', () => {
  // MOON_GOOD (4,270 kg) + pressurised rover (3,000 kg) + 150 kWh battery (1,000 kg) = 8,270 kg > 8,000.
  const over: Design = {
    ...MOON_GOOD_DESIGN,
    partIds: [...MOON_GOOD_DESIGN.partIds, 'rover-pressurized', 'battery-li-150kwh'],
  }

  it('a cost-focused teammate accepts a trade that fixes over-mass', () => {
    const costFocused = {
      ...crewById('sana'),
      priorities: { science: 0.2, safety: 0.2, cost: 0.6 },
    }
    const trade: Trade = {
      from: 'science',
      to: 'power_life',
      give: [{ kind: 'removePart', partId: 'rover-pressurized' }],
      ask: [{ kind: 'swapPart', fromId: 'battery-li-150kwh', toId: 'battery-li-50kwh' }],
    }
    const r = evaluateTrade(trade, costFocused, over, content)
    expect(r.verdict).toBe('accept')
    // 8,270 − 3,000 − 650 = 4,620 kg; the rover (5 pts/day) leaves with it: 9 → 4 science per day
    expect(r.reason).toBe(
      'Deal — it gets us under the rocket limit: mass 8,270 → 4,620 kg (limit 8,000), cost $1,105M → $830M, science 9 → 4 pts/day.',
    )
    expect(r.dialogueKey).toMatch(/^accept:\d$/)
  })

  it('the science lead refuses to lose the only instrument', () => {
    const trade: Trade = {
      from: 'power_life',
      to: 'science',
      give: [],
      ask: [{ kind: 'removePart', partId: 'ice-drill-spectrometer' }],
    }
    const r = evaluateTrade(trade, crewById('ayesha'), over, content)
    expect(r.verdict).toBe('refuse')
    expect(r.reason).toMatch(/no instrument at all/)
  })

  it('refuses trades over items the parties do not own', () => {
    const trade: Trade = {
      from: 'science',
      to: 'power_life',
      give: [{ kind: 'rocket', rocketId: 'heavy-lunar-launcher' }],
      ask: [],
    }
    expect(evaluateTrade(trade, crewById('sana'), over, content).verdict).toBe('refuse')
  })

  it('Launch & Budget vetoes trades that push the team over budget (Flight Director: $960M)', () => {
    const tight: Design = { ...MOON_GOOD_DESIGN, difficulty: 'flight_director' } // $815M of $960M
    const trade: Trade = {
      from: 'science',
      to: 'power_life',
      give: [{ kind: 'addPart', partId: 'rover-pressurized' }],
      ask: [],
    }
    const r = evaluateTrade(trade, crewById('bilal'), tight, content)
    expect(r.verdict).toBe('refuse')
    expect(r.reason).toBe(
      'Kofi Mensah (Launch & Budget) vetoes it: cost would go from $815M to $1,065M, over the $960M budget.',
    )
  })

  it('same inputs give the same verdict, reason and dialogue line', () => {
    const trade: Trade = {
      from: 'science',
      to: 'power_life',
      give: [],
      ask: [{ kind: 'supply', resource: 'waterKg', deltaKg: -40 }],
    }
    const a = evaluateTrade(trade, crewById('bilal'), over, content)
    expect(evaluateTrade(trade, crewById('bilal'), over, content)).toEqual(a)
  })

  it('any counter-offer is one the teammate would accept', () => {
    const asks = [
      { kind: 'removePart', partId: 'battery-li-150kwh' },
      { kind: 'swapPart', fromId: 'regen-fuel-cell-200kwh', toId: 'battery-li-50kwh' },
      { kind: 'supply', resource: 'foodKg', deltaKg: -60 },
    ] as const
    for (const ask of asks) {
      for (const id of ['bilal', 'sana']) {
        const trade: Trade = { from: 'science', to: 'power_life', give: [], ask: [ask] }
        const r = evaluateTrade(trade, crewById(id), over, content)
        if (r.verdict === 'counter')
          expect(evaluateTrade(r.counter!, crewById(id), over, content).verdict).toBe('accept')
      }
    }
  })
})

describe('hints and read-outs', () => {
  it('suggestFixes: at most 3, each reduces the overshoot, none for a design within limits', () => {
    expect(suggestFixes(MOON_GOOD_DESIGN, content)).toEqual([])
    const d = propose('shackleton-ice-hunt', 'science', 'engineer')
    const before = computeTotals(d, content).massKg
    const fixes = suggestFixes(d, content)
    expect(fixes.length).toBeGreaterThan(0)
    expect(fixes.length).toBeLessThanOrEqual(3)
    for (const f of fixes) {
      expect(
        computeTotals(applyChange(d, f.change), content).massKg < before ||
          f.change.kind === 'rocket',
      ).toBe(true)
      expect(f.text).toMatch(/: [−+]\d[\d,]* kg, [−+]\$\d/)
    }
  })

  it('gauges carry the launch check status and sentence', () => {
    const checks = runLaunchCheck(MOON_GOOD_DESIGN, content)
    const gauges = planningGauges(MOON_GOOD_DESIGN, content)
    expect(gauges.map((g) => g.id)).toEqual([
      'mass',
      'budget',
      'power',
      'battery',
      'data',
      'supplies',
    ])
    expect(gauges.find((g) => g.id === 'budget')!.explanation).toBe(
      checks.find((c) => c.id === 'budget')!.explanation,
    )
  })

  it('supply days and kg convert both ways (water at 90% recycling: 4 × 3.0 × 0.1 = 1.2 kg/day)', () => {
    expect(supplyDaysToKg(MOON_GOOD_DESIGN, 'waterKg', 10, content)).toBeCloseTo(12, 10)
    expect(supplyKgToDays(MOON_GOOD_DESIGN, 'waterKg', 12, content)).toBeCloseTo(10, 10)
  })

  it('role usage: Power & Life owns the supplies mass; Launch & Budget the rocket cost', () => {
    // supplies 130 + 270 + 100 = 500 kg on top of its parts
    const power = roleUsage(MOON_GOOD_DESIGN, 'power_life', content)
    expect(power.massKg).toBe(140 + 900 + 350 + 400 + 1200 + 240 + 60 + 500)
    expect(roleUsage(MOON_GOOD_DESIGN, 'launch_budget', content).costM).toBe(150)
  })
})
