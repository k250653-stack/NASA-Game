import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { hasIcon } from './icons'

describe('icon registry', () => {
  it('registers every icon named in parts.json', () => {
    const missing = loadContent()
      .parts.map((p) => p.icon)
      .filter((name) => !hasIcon(name))
    expect(missing, `add these to src/ui/icons.ts: ${missing.join(', ')}`).toEqual([])
  })
})
