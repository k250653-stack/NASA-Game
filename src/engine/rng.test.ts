import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('createRng (mulberry32)', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 50 }, () => a.next())
    const seqB = Array.from({ length: 50 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('next() stays in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 5000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int(min, max) stays within the inclusive range and reaches both ends', () => {
    const rng = createRng(123)
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      const v = rng.int(3, 7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
      seen.add(v)
    }
    expect(seen.has(3)).toBe(true)
    expect(seen.has(7)).toBe(true)
  })

  it('int(min, max) handles a single-value range', () => {
    const rng = createRng(5)
    expect(rng.int(4, 4)).toBe(4)
  })

  it('int(min, max) rejects a reversed or non-integer range', () => {
    const rng = createRng(5)
    expect(() => rng.int(5, 1)).toThrow()
    expect(() => rng.int(0.5, 2)).toThrow()
  })

  it('chance(0) is always false and chance(1) is always true', () => {
    const rng = createRng(99)
    for (let i = 0; i < 1000; i++) {
      expect(rng.chance(0)).toBe(false)
      expect(rng.chance(1)).toBe(true)
    }
  })

  it('chance(p) is roughly p over many draws', () => {
    const rng = createRng(2024)
    let hits = 0
    const n = 20000
    for (let i = 0; i < n; i++) if (rng.chance(0.3)) hits++
    expect(hits / n).toBeGreaterThan(0.27)
    expect(hits / n).toBeLessThan(0.33)
  })

  it('pick() returns an element of the array and is reproducible', () => {
    const items = ['a', 'b', 'c', 'd'] as const
    const a = createRng(11)
    const b = createRng(11)
    for (let i = 0; i < 100; i++) {
      const pa = a.pick(items)
      expect(items).toContain(pa)
      expect(pa).toBe(b.pick(items))
    }
  })

  it('pick() throws on an empty array', () => {
    expect(() => createRng(1).pick([])).toThrow()
  })

  it('rejects a non-finite seed', () => {
    expect(() => createRng(Number.NaN)).toThrow()
  })
})
