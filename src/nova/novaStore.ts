/**
 * NOVA's own state: tutorial progress, lessons seen (the Codex) and what is open right now.
 * Saved separately from the game so lessons stay unlocked across new games.
 * Read with selectors only: useNova((s) => s.openLessonId).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Difficulty } from '@/schemas'

interface NovaState {
  /** NOVA has introduced itself in the HQ lobby. */
  introDone: boolean
  /** Index of the last HQ step NOVA explained (-1 = none yet). */
  stepSaid: number
  habitatIntroDone: boolean
  tutorialSkipped: boolean
  /** NOVA has explained "Do it yourself" hands-on tasks. */
  diyTipShown: boolean
  /** NOVA tip ids shown at least once: the Codex "NOVA notes". */
  tipsSeen: string[]
  /** Lesson ids opened at least once: the Codex. */
  lessonsSeen: string[]
  openLessonId: string | null
  codexOpen: boolean
  set: (patch: Partial<Omit<NovaState, 'set'>>) => void
}

const initialTutorial = {
  introDone: false,
  stepSaid: -1,
  habitatIntroDone: false,
  tutorialSkipped: false,
  diyTipShown: false,
}

export const useNova = create<NovaState>()(
  persist(
    (set) => ({
      ...initialTutorial,
      lessonsSeen: [],
      tipsSeen: [],
      openLessonId: null,
      codexOpen: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'mission-control-nova',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        introDone: s.introDone,
        stepSaid: s.stepSaid,
        habitatIntroDone: s.habitatIntroDone,
        tutorialSkipped: s.tutorialSkipped,
        diyTipShown: s.diyTipShown,
        lessonsSeen: s.lessonsSeen,
        tipsSeen: s.tipsSeen,
      }),
    },
  ),
)

/** Hints follow the player's choice in Settings, else the difficulty (off for Flight Director). */
export function hintsOn(setting: boolean | null, difficulty: Difficulty): boolean {
  return setting ?? difficulty !== 'flight_director'
}

export function openLesson(id: string): void {
  const { lessonsSeen } = useNova.getState()
  useNova.setState({
    openLessonId: id,
    lessonsSeen: lessonsSeen.includes(id) ? lessonsSeen : [...lessonsSeen, id],
  })
}

export function closeLesson(): void {
  useNova.setState({ openLessonId: null })
}
export function openCodex(): void {
  useNova.setState({ codexOpen: true })
}
export function closeCodex(): void {
  useNova.setState({ codexOpen: false })
}
export function skipTutorial(): void {
  useNova.setState({ tutorialSkipped: true })
}
/** Pause menu "Replay tutorial": NOVA starts again from the introduction. */
export function replayTutorial(): void {
  useNova.setState({ ...initialTutorial })
}
