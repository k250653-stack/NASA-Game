import { describe, expect, it } from 'vitest'
import { loadContent } from '@/content/load'
import { analyzeTeam } from '../teamBalance'

const content = loadContent()
const rules = content.constants.teamRules
const crew = (...ids: string[]) => ids.map((id) => content.crew.find((c) => c.id === id)!)

describe('analyzeTeam', () => {
  it('full sample crew: thinker + practical present, 2 leaders -> morale −2/turn', () => {
    // Priya (leader, thinker) and Theo (practical, leader) are both leaders.
    const a = analyzeTeam(
      crew('mina-okafor', 'jonas-reyes', 'priya-natarajan', 'theo-lindqvist'),
      rules,
    )
    expect(a.hasThinker).toBe(true)
    expect(a.hasPractical).toBe(true)
    expect(a.leaderCount).toBe(2)
    expect(a.modifiers).toEqual({
      repairSuccess: 0,
      decisionActionsPerTurn: 0,
      moraleDrift: -2,
      diagnoseAvailable: true,
    })
    expect(a.warnings).toHaveLength(1)
    expect(a.warnings[0]).toMatch(/morale drops by 2/)
  })

  it('balanced pair (practical + leader/thinker) has no warnings', () => {
    const a = analyzeTeam(crew('jonas-reyes', 'priya-natarajan'), rules)
    expect(a.warnings).toEqual([])
    expect(a.modifiers.repairSuccess).toBe(0)
    expect(a.modifiers.decisionActionsPerTurn).toBe(0)
  })

  it('no leader -> one fewer decision action per turn', () => {
    const a = analyzeTeam(crew('mina-okafor', 'jonas-reyes'), rules)
    expect(a.leaderCount).toBe(0)
    expect(a.modifiers.decisionActionsPerTurn).toBe(-1)
    expect(a.warnings[0]).toMatch(/no Leader/)
  })

  it('no practical -> repair success −0.25 (shown as 25%)', () => {
    const a = analyzeTeam(crew('mina-okafor', 'priya-natarajan'), rules)
    expect(a.modifiers.repairSuccess).toBe(-0.25)
    expect(a.warnings[0]).toMatch(/25% less likely/)
  })

  it('zero crew: every rule triggers and diagnose is unavailable', () => {
    const a = analyzeTeam([], rules)
    expect(a.modifiers).toEqual({
      repairSuccess: -0.25,
      decisionActionsPerTurn: -1,
      moraleDrift: 0,
      diagnoseAvailable: false,
    })
    expect(a.warnings).toHaveLength(3)
  })
})
