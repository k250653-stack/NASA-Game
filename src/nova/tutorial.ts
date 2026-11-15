/**
 * NOVA's tutorial script and the hooks that decide what NOVA says in the HQ and the habitat.
 * HQ steps follow game progress (the same gates as the lobby doors), so the tutorial never
 * points at a room the player has already finished.
 */
import { useStore } from '@/store'
import { useSettings } from '@/ui/settingsStore'
import { hintsOn, useNova } from './novaStore'

export const INTRO_LINES = [
  "Hi, I'm NOVA, your mission guide. I hover, I calculate, I don't do stairs.",
  'Your job: plan a crewed mission to the Moon or Mars, launch it, and bring everyone home.',
  'Each room off the lobby is one step. Walk through the doorway I mark, then press E on what glows.',
] as const

/** One room per step, in order, with what NOVA says when it becomes the next step. */
export const HQ_STEPS = [
  {
    roomId: 'mission-planning',
    line: 'Mission Planning first, through the blue doorway: pick where you are going and which scenario to fly.',
  },
  {
    roomId: 'personnel',
    line: 'Personnel, through the green doorway: choose your seat and recruit the crew who fill the others.',
  },
  {
    roomId: 'briefing',
    line: 'Briefing, through the amber doorway: the planning board. Fit parts, supplies and the rocket inside mass and budget.',
  },
  {
    roomId: 'launch-control',
    line: 'Launch Control, through the red doorway: every seat calls go or no-go. Then we fly.',
  },
] as const

export const HABITAT_LINES = [
  'We made it. Top left is the mission day and phase; top right, your power, air, water, food and science.',
  'Next Turn moves the mission forward. Fast-forward keeps going until something needs you.',
  'When an event hits your seat, I pause everything: pick an option, a crew member, and watch the odds.',
] as const

export function useHints(): boolean {
  const setting = useSettings((s) => s.hints)
  const difficulty = useStore((s) => s.game.difficulty)
  return hintsOn(setting, difficulty)
}

export interface Script {
  lines: readonly string[] | null
  onDone: () => void
  /** HQ room id for the marker, or null. */
  marker: string | null
  active: boolean
}

/**
 * HQ tutorial: the introduction once, then one line each time a new step becomes next.
 * `locks` = lock reason per gated room id (null = open), as HQWorld already computes it.
 */
export function useHqTutorial(locks: Record<string, string | null>, blocked: boolean): Script {
  const hints = useHints()
  const introDone = useNova((s) => s.introDone)
  const stepSaid = useNova((s) => s.stepSaid)
  const skipped = useNova((s) => s.tutorialSkipped)
  const launched = useStore((s) => s.mission.run !== null)
  // A step is done once the next room opens (the last one once a mission has launched).
  const done = [
    locks['personnel'] === null,
    locks['briefing'] === null,
    locks['launch-control'] === null,
    launched,
  ]
  const step = done.findIndex((d) => !d)
  const active = hints && !skipped && step >= 0
  if (!active) return { lines: null, onDone: () => {}, marker: null, active }
  const marker = HQ_STEPS[step]!.roomId
  if (!introDone)
    return {
      lines: blocked ? null : INTRO_LINES,
      onDone: () => useNova.setState({ introDone: true }),
      marker,
      active,
    }
  if (stepSaid < step)
    return {
      lines: blocked ? null : [HQ_STEPS[step]!.line],
      onDone: () => useNova.setState({ stepSaid: step }),
      marker,
      active,
    }
  return { lines: null, onDone: () => {}, marker, active }
}

/** Habitat: explain the HUD on the first arrival. */
export function useHabitatTutorial(blocked: boolean): Script {
  const hints = useHints()
  const done = useNova((s) => s.habitatIntroDone)
  const skipped = useNova((s) => s.tutorialSkipped)
  const active = hints && !skipped && !done
  return {
    lines: active && !blocked ? HABITAT_LINES : null,
    onDone: () => useNova.setState({ habitatIntroDone: true }),
    marker: null,
    active,
  }
}
