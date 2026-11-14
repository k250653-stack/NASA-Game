/**
 * Seeded random number generator (mulberry32).
 *
 * This is the ONLY source of randomness in the project (CLAUDE.md rule 7).
 * The same seed always produces the same sequence, so a demo run can be replayed exactly.
 */

export interface Rng {
  /** The seed this generator was created with. */
  readonly seed: number
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** True with probability p. chance(0) is always false, chance(1) is always true. */
  chance(p: number): boolean
  /** One uniformly chosen element of a non-empty array. */
  pick<T>(array: readonly T[]): T
}

const TWO_POW_32 = 4294967296

export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) {
    throw new Error(`createRng: seed must be a finite number, got ${String(seed)}`)
  }

  // mulberry32 state: a 32-bit unsigned integer.
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / TWO_POW_32
  }

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error(`rng.int: min and max must be integers, got ${min} and ${max}`)
    }
    if (max < min) {
      throw new Error(`rng.int: max (${max}) must be >= min (${min})`)
    }
    return min + Math.floor(next() * (max - min + 1))
  }

  const chance = (p: number): boolean => {
    if (p <= 0) return false
    if (p >= 1) return true
    return next() < p
  }

  const pick = <T>(array: readonly T[]): T => {
    if (array.length === 0) {
      throw new Error('rng.pick: cannot pick from an empty array')
    }
    // int() guarantees an index inside the array, so the lookup cannot be undefined.
    return array[int(0, array.length - 1)] as T
  }

  return { seed, next, int, chance, pick }
}
