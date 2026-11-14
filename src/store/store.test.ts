import { beforeEach, describe, expect, it } from 'vitest'
import { PHASES, resetAll, useStore } from './index'

describe('store navigation (phase = screen)', () => {
  beforeEach(() => resetAll())

  it('starts on the title screen with the demo seed', () => {
    expect(useStore.getState().game.phase).toBe('title')
    expect(useStore.getState().game.seed).toBe(20261114)
  })

  it('Next walks forward through every phase in order and stops at the last one', () => {
    const visited = [useStore.getState().game.phase]
    for (let i = 0; i < PHASES.length + 2; i++) {
      useStore.getState().nextPhase()
      visited.push(useStore.getState().game.phase)
    }
    expect(visited.slice(0, PHASES.length)).toEqual([...PHASES])
    expect(useStore.getState().game.phase).toBe('codex')
  })

  it('Back walks backward and never goes before the title', () => {
    useStore.getState().setPhase('codex')
    const visited = [useStore.getState().game.phase]
    for (let i = 0; i < PHASES.length + 2; i++) {
      useStore.getState().prevPhase()
      visited.push(useStore.getState().game.phase)
    }
    expect(visited.slice(0, PHASES.length)).toEqual([...PHASES].reverse())
    expect(useStore.getState().game.phase).toBe('title')
  })
})

describe('store slices', () => {
  beforeEach(() => resetAll())

  it('design: togglePart adds then removes, setRocket stores the id', () => {
    const s = useStore.getState()
    s.togglePart('battery-20kwh')
    s.togglePart('solar-array-5kw')
    expect(useStore.getState().design.partIds).toEqual(['battery-20kwh', 'solar-array-5kw'])
    s.togglePart('battery-20kwh')
    expect(useStore.getState().design.partIds).toEqual(['solar-array-5kw'])
    s.setRocket('medium-lunar-launcher')
    expect(useStore.getState().design.rocketId).toBe('medium-lunar-launcher')
  })

  it('crew: recruit is idempotent and dismiss removes', () => {
    const s = useStore.getState()
    s.recruit('mina-okafor')
    s.recruit('mina-okafor')
    s.recruit('jonas-reyes')
    expect(useStore.getState().crew.recruitedIds).toEqual(['mina-okafor', 'jonas-reyes'])
    s.dismiss('mina-okafor')
    expect(useStore.getState().crew.recruitedIds).toEqual(['jonas-reyes'])
  })

  it('mission: adjustResource accumulates and appendLog keeps order', () => {
    const s = useStore.getState()
    s.adjustResource('powerWh', 1000)
    s.adjustResource('powerWh', -250)
    s.appendLog({ day: 1, kind: 'info', text: 'Landed.' })
    s.appendLog({ day: 2, kind: 'warning', text: 'Dust on array.' })
    expect(useStore.getState().mission.resources['powerWh']).toBe(750)
    expect(useStore.getState().mission.log.map((l) => l.day)).toEqual([1, 2])
  })

  it('resetAll clears every slice', () => {
    const s = useStore.getState()
    s.setPhase('mission')
    s.togglePart('x')
    s.recruit('y')
    s.setDay(9)
    resetAll()
    const after = useStore.getState()
    expect(after.game.phase).toBe('title')
    expect(after.design.partIds).toEqual([])
    expect(after.crew.recruitedIds).toEqual([])
    expect(after.mission.day).toBe(0)
  })
})
