import { describe, expect, it } from 'vitest'
import { ContentValidationError, RAW_CONTENT, loadContent, validateContent } from './load'

/** Deep-clones the bundled JSON so a test can break one field without touching the others. */
function cloneRaw(): {
  constants: unknown
  destinations: unknown
  scenarios: unknown
  crew: unknown
  parts: unknown
  rockets: unknown
  events: unknown
  lessons: unknown
  roles: unknown
  baseSlots: unknown
} {
  return structuredClone(RAW_CONTENT)
}

describe('content loading', () => {
  it('validates every bundled content file', () => {
    const content = loadContent()
    expect(content.destinations.map((d) => d.id)).toEqual(['moon', 'mars'])
    expect(content.scenarios.map((s) => s.id)).toEqual(['shackleton-ice-hunt', 'jezero-long-stay'])
    expect(content.crew.filter((c) => !c.isPlayer)).toHaveLength(8)
    expect(content.crew.filter((c) => c.isPlayer).map((c) => c.id)).toEqual([
      'player-science',
      'player-power-life',
      'player-comms-nav',
      'player-launch-budget',
      'player-director',
    ])
    expect(content.roles.map((r) => r.id)).toEqual([
      'science',
      'power_life',
      'comms_nav',
      'launch_budget',
      'director',
    ])
    expect(content.parts.length).toBeGreaterThanOrEqual(16)
    expect(content.constants.perCrewPerDay.oxygenKg).toBe(0.84)
    expect(content.rockets).toHaveLength(4)
    expect(content.events.length).toBeGreaterThanOrEqual(20)
    expect(content.events.filter((e) => e.positive).length).toBeGreaterThanOrEqual(5)
    for (const d of ['moon', 'mars']) {
      expect(content.events.filter((e) => e.destinations.includes(d)).length).toBeGreaterThan(10)
    }
    expect(new Set(content.events.map((e) => e.role)).size).toBe(4)
    expect(content.lessons).toHaveLength(1)
  })

  it('every recycler draws power and can fail (so recycling is a trade-off)', () => {
    const recyclers = loadContent().parts.filter(
      (p) => (p.stats.waterRecoveryRate ?? 0) > 0 || (p.stats.oxygenRecoveryRate ?? 0) > 0,
    )
    expect(recyclers.length).toBeGreaterThanOrEqual(4)
    for (const p of recyclers) {
      expect(p.powerW, p.id).toBeLessThan(0)
      expect(p.stats.failureChancePerTurn ?? 0, p.id).toBeGreaterThan(0)
    }
  })

  it('rejects a scenario whose duration does not match the phase days', () => {
    const raw = cloneRaw()
    const scenarios = raw.scenarios as { items: Array<{ durationDays: number }> }
    scenarios.items[1]!.durationDays = 700
    expect(() => validateContent(raw)).toThrow(
      /"jezero-long-stay" -> durationDays is 700 but the "mars" phases add up to 730 days \(outbound 210 \+ surface 300 \+ return 220\)/,
    )
  })

  it('sample crew covers all four roles and all three traits', () => {
    const { crew } = loadContent()
    expect(new Set(crew.map((c) => c.role)).size).toBe(4)
    expect(new Set(crew.flatMap((c) => c.traits)).size).toBe(3)
  })

  it('reports the file and field when a number is out of range', () => {
    const raw = cloneRaw()
    const dests = raw.destinations as { items: Array<{ gravityG: number }> }
    dests.items[1]!.gravityG = 7
    expect(() => validateContent(raw)).toThrow(ContentValidationError)
    expect(() => validateContent(raw)).toThrow(/destinations\.json/)
    expect(() => validateContent(raw)).toThrow(/items\[1\]\.gravityG \(id "mars"\)/)
  })

  it('rejects unknown keys (strict objects)', () => {
    const raw = cloneRaw()
    const parts = raw.parts as { items: Array<Record<string, unknown>> }
    parts.items[0]!['colour'] = 'red'
    expect(() => validateContent(raw)).toThrow(/parts\.json/)
    expect(() => validateContent(raw)).toThrow(/colour/)
  })

  it('rejects an unknown part stat key', () => {
    const raw = cloneRaw()
    const parts = raw.parts as { items: Array<{ stats: Record<string, number> }> }
    parts.items[0]!.stats = { warpFactor: 9 }
    expect(() => validateContent(raw)).toThrow(/parts\.json/)
    expect(() => validateContent(raw)).toThrow(
      /items\[0\]\.stats \(id "solar-array-5kw"\): Unrecognized key: "warpFactor"/,
    )
  })

  it('every part category has at least two options', () => {
    const counts = new Map<string, number>()
    loadContent().parts.forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1))
    expect(counts.size).toBe(9)
    counts.forEach((n) => expect(n).toBeGreaterThanOrEqual(2))
  })

  it('rejects crew priorities that do not sum to 1', () => {
    const raw = cloneRaw()
    const crew = raw.crew as { items: Array<{ priorities: Record<string, number> }> }
    crew.items[0]!.priorities = { science: 0.5, safety: 0.5, cost: 0.5 }
    expect(() => validateContent(raw)).toThrow(/crew\.json/)
    expect(() => validateContent(raw)).toThrow(/sum to 1/)
  })

  it('rejects a scenario that points at a missing destination', () => {
    const raw = cloneRaw()
    const scenarios = raw.scenarios as { items: Array<{ destinationId: string }> }
    scenarios.items[0]!.destinationId = 'venus'
    expect(() => validateContent(raw)).toThrow(/scenarios\.json/)
    expect(() => validateContent(raw)).toThrow(/"venus" does not exist/)
  })

  it('rejects a lesson without a source URL', () => {
    const raw = cloneRaw()
    const lessons = raw.lessons as { items: Array<{ source: string }> }
    lessons.items[0]!.source = 'trust me'
    expect(() => validateContent(raw)).toThrow(/lessons\.json/)
    expect(() => validateContent(raw)).toThrow(/source/)
  })
})
