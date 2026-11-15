import { useEffect } from 'react'
import { getContent } from '@/content/load'
import { useStore } from '@/store'
import { subscribeConcepts } from '@/store/concepts'
import { useSettings } from '@/ui/settingsStore'
import { LessonPopup } from './LessonPopup'
import { NovaCodex } from './NovaCodex'
import { hintsOn, openLesson, useNova } from './novaStore'

/**
 * Always mounted (App): the first time a concept comes up, NOVA opens its lesson (hints on) or
 * quietly adds it to the notes (hints off). Also renders the lesson popup and the Codex.
 */
export function NovaLayer() {
  useEffect(
    () =>
      subscribeConcepts((concept) => {
        const lesson = getContent().lessons.find((l) => l.trigger === concept)
        if (!lesson) return
        const nova = useNova.getState()
        if (nova.lessonsSeen.includes(lesson.id)) return
        if (hintsOn(useSettings.getState().hints, useStore.getState().game.difficulty)) {
          openLesson(lesson.id)
        } else {
          useNova.setState({ lessonsSeen: [...nova.lessonsSeen, lesson.id] })
        }
      }),
    [],
  )
  return (
    <>
      <NovaCodex />
      <LessonPopup />
    </>
  )
}
