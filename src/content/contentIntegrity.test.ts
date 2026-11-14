/** Cross-file content checks and project-wide guards (Prompt 8 Part A2). */
import { describe, expect, it } from 'vitest'
import { PART_CATEGORIES } from '@/schemas'
import { totalMissionDays } from '@/engine/timeline'
import { hasIcon } from '@/ui/icons'
import { loadContent } from './load'

const content = loadContent()

describe('content integrity', () => {
  it('every JSON content file validates', () => {
    expect(() => loadContent()).not.toThrow()
  })

  it('every crew portrait id follows crew-<id> (players share crew-player)', () => {
    for (const m of content.crew) {
      expect(m.portrait, m.id).toBe(m.isPlayer ? 'crew-player' : `crew-${m.id}`)
    }
  })

  it('every recruitable crew member has dialogue for all four moods', () => {
    for (const m of content.crew.filter((x) => !x.isPlayer)) {
      expect(Object.keys(m.dialogue ?? {}).sort(), m.id).toEqual([
        'accept',
        'counter',
        'refuse',
        'request',
      ])
    }
  })

  it('every part icon and role icon is registered', () => {
    for (const p of content.parts) expect(hasIcon(p.icon), p.id).toBe(true)
    for (const r of content.roles) expect(hasIcon(r.icon), r.id).toBe(true)
  })

  it('event ids referenced elsewhere exist', () => {
    const ids = new Set(content.events.map((e) => e.id))
    for (const id of content.constants.scoring.conflictEventIds) expect(ids.has(id), id).toBe(true)
  })

  it('base slots: one layout per destination, valid categories, a slot for every category in use', () => {
    for (const d of content.destinations) {
      const layout = content.baseSlots.find((b) => b.destinationId === d.id)
      expect(layout, d.id).toBeDefined()
      for (const s of layout!.slots) expect(PART_CATEGORIES).toContain(s.category)
      for (const cat of new Set(content.parts.map((p) => p.category))) {
        expect(
          layout!.slots.some((s) => s.category === cat),
          `${d.id} ${cat}`,
        ).toBe(true)
      }
    }
  })

  it('base slot markers never overlap (centres ≥ 6% apart across or ≥ 10% down)', () => {
    // A 32 px marker on a ~640 x 360 px base view: 6% ≈ 38 px across, 10% ≈ 36 px down.
    for (const layout of content.baseSlots) {
      const s = layout.slots
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++) {
          const clear = Math.abs(s[i]!.x - s[j]!.x) >= 6 || Math.abs(s[i]!.y - s[j]!.y) >= 10
          expect(clear, `${layout.id}: ${s[i]!.slotId} vs ${s[j]!.slotId}`).toBe(true)
        }
    }
  })

  it('every scenario duration equals its destination phase days (Moon 34, Mars 730)', () => {
    for (const s of content.scenarios) {
      const d = content.destinations.find((x) => x.id === s.destinationId)!
      expect(s.durationDays, s.id).toBe(totalMissionDays(d))
    }
  })

  it('roles.json gives every part category to exactly one seat (besides the Mission Director)', () => {
    for (const cat of PART_CATEGORIES) {
      const owners = content.roles.filter(
        (r) => r.id !== 'director' && r.owns.categories.includes(cat),
      )
      expect(owners.length, cat).toBe(1)
    }
  })
})

describe('project guards', () => {
  const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
  const code = Object.entries(sources).filter(
    ([path]) => !path.includes('__tests__') && !path.endsWith('.test.ts'),
  )

  it('scans the source tree', () => {
    expect(code.length).toBeGreaterThan(50)
  })

  it('no Math.random anywhere in src (all randomness via engine/rng.ts)', () => {
    const offenders = code
      .filter(([, text]) => /Math\.random\s*\(/.test(text))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('no engine file imports React, screens, ui or store', () => {
    const offenders = code
      .filter(([path]) => path.startsWith('/src/engine/'))
      .filter(([, text]) =>
        /from ['"](react|react-dom)['"/]|from ['"]@\/(screens|ui|store)\//.test(text),
      )
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
