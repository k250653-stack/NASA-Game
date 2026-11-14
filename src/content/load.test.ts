import { describe, expect, it } from 'vitest'
import { ContentValidationError, RAW_CONTENT, loadContent, validateContent } from './load'

/** Deep-clones the bundled JSON so a test can break one field without touching the others. */
function cloneRaw(): {
  destinations: unknown
  scenarios: unknown
  crew: unknown
  parts: unknown
  rockets: unknown
  events: unknown
  lessons: unknown
} {
  return structuredClone(RAW_CONTENT)
}

describe('content loading', () => {
  it('validates every bundled content file', () => {
    const content = loadContent()
    expect(content.destinations.map((d) => d.id)).toEqual(['moon', 'mars'])
    expect(content.scenarios).toHaveLength(1)
    expect(content.crew).toHaveLength(4)
    expect(content.parts).toHaveLength(8)
    expect(content.rockets).toHaveLength(3)
    expect(content.events).toHaveLength(2)
    expect(content.lessons).toHaveLength(1)
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
