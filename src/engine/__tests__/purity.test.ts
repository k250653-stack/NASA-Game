import { describe, expect, it } from 'vitest'

/** Every engine source file (not tests), as raw text. */
const sources = import.meta.glob<string>('../*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const files = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'))

describe('engine purity (CLAUDE.md rules 1 and 7)', () => {
  it('finds the engine files', () => {
    expect(files.length).toBeGreaterThanOrEqual(10)
  })

  it.each(files)('%s imports no React or UI layers', (_path, code) => {
    expect(code).not.toMatch(/from ['"]react(-dom)?(\/[^'"]*)?['"]/)
    expect(code).not.toMatch(/from ['"]@\/(screens|ui|store|nova|controlroom)\//)
  })

  it.each(files)('%s never calls Math.random', (_path, code) => {
    expect(code).not.toMatch(/Math\.random/)
  })
})
