import { useEffect } from 'react'
import { getContent } from '@/content/load'
import { ROLE_LABEL } from '@/ui/labels'
import { closeCodex, openLesson, useNova } from './novaStore'

/** Short NOVA notes: every tip and fact NOVA has shown so far. */
export function NovaNotes() {
  const seen = useNova((s) => s.tipsSeen)
  const tips = getContent().novaTips.filter((t) => seen.includes(t.id))
  if (tips.length === 0) return null
  return (
    <section className="mt-4 border-t-2 border-border pt-3" data-testid="nova-notes">
      <h3 className="label-caps text-sm text-alert">NOVA notes</h3>
      <ul className="mt-1 space-y-2">
        {tips.map((t) => (
          <li key={t.id} className="text-sm text-muted">
            {t.text}
            {t.source?.startsWith('http') && (
              <a
                href={t.source}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-accent underline"
              >
                source
              </a>
            )}
            {t.lessonId && seen && useNova.getState().lessonsSeen.includes(t.lessonId) && (
              <button
                type="button"
                className="ml-2 text-accent underline"
                onClick={() => openLesson(t.lessonId!)}
              >
                lesson
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Every lesson: seen ones can be replayed, the rest show as locked. */
export function CodexList() {
  const seen = useNova((s) => s.lessonsSeen)
  const lessons = getContent().lessons
  return (
    <ul className="divide-y divide-border" data-testid="codex-list">
      {lessons.map((l) => {
        const open = seen.includes(l.id)
        return (
          <li
            key={l.id}
            className="flex items-center gap-3 py-2"
            data-testid={`codex-${l.id}`}
            data-locked={!open}
          >
            <span
              className={`font-mono text-sm ${open ? 'text-accent' : 'text-subtle'}`}
              aria-hidden
            >
              {open ? '◆' : '▢'}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`font-title tracking-wide uppercase ${open ? 'text-primary' : 'text-subtle'}`}
              >
                {open ? l.title : 'Locked lesson'}
              </p>
              <p className="text-xs text-muted">
                {open
                  ? ROLE_LABEL[l.role]
                  : 'NOVA explains this when it first comes up in a mission.'}
              </p>
            </div>
            {open && (
              <button
                type="button"
                onClick={() => openLesson(l.id)}
                className="border border-accent px-3 py-1 font-title tracking-widest text-accent uppercase hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
              >
                Replay
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** "NOVA's notes" from the pause menu or by clicking NOVA. */
export function NovaCodex() {
  const open = useNova((s) => s.codexOpen)
  const lessonOpen = useNova((s) => s.openLessonId !== null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useNova.getState().openLessonId) return
      e.preventDefault()
      e.stopPropagation()
      closeCodex()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  if (!open || lessonOpen) return null
  const seen = useNova.getState().lessonsSeen.length
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-bg/70"
      data-testid="nova-codex"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="NOVA's notes"
        className="pixel-panel h-[92vh] w-[92vw] overflow-y-auto px-[max(1.5rem,calc((92vw-40rem)/2))] py-6"
      >
        <header className="flex items-baseline justify-between">
          <h2 className="font-title text-2xl tracking-wide text-primary uppercase">
            NOVA&apos;s notes
          </h2>
          <span className="font-mono text-xs text-muted tabular-nums">
            {seen} / {getContent().lessons.length} unlocked
          </span>
        </header>
        <div className="mt-3">
          <CodexList />
          <NovaNotes />
        </div>
        <button
          type="button"
          onClick={closeCodex}
          className="mt-4 border border-border-strong px-4 py-1.5 font-title tracking-widest text-muted uppercase hover:text-primary focus-visible:outline-2 focus-visible:outline-accent"
        >
          Close
        </button>
      </div>
    </div>
  )
}
