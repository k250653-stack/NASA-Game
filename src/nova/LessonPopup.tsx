import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import { getContent } from '@/content/load'
import type { Lesson, VizKind } from '@/schemas'
import { useStore } from '@/store'
import { applyValues, fillTemplate, vizLive, type VizLive } from './applyValues'
import { currentDesign } from './currentDesign'
import { NovaSprite } from './NovaSprite'
import { closeLesson, useNova } from './novaStore'
import { LifeSupportViz } from './viz/LifeSupportViz'
import { MassViz } from './viz/MassViz'
import { OrbitViz } from './viz/OrbitViz'
import { PowerViz } from './viz/PowerViz'
import { SignalViz } from './viz/SignalViz'
import type { VizProps } from './viz/VizFrame'

const VIZ: Record<VizKind, ComponentType<VizProps>> = {
  orbit: OrbitViz,
  power: PowerViz,
  signal: SignalViz,
  mass: MassViz,
  life_support: LifeSupportViz,
}
const BTN =
  'border px-3 py-1.5 font-title tracking-widest uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** The open NOVA lesson: predict first, then steps, visual, formula, your numbers and the source. */
export function LessonPopup() {
  const id = useNova((s) => s.openLessonId)
  const lesson = getContent().lessons.find((l) => l.id === id)
  useEffect(() => {
    if (!lesson) return
    // Capture phase, so the world's own Esc handling sees it as handled.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeLesson()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [lesson])
  if (!lesson) return null
  return <LessonBody key={lesson.id} lesson={lesson} />
}

function LessonBody({ lesson }: { lesson: Lesson }) {
  const [guess, setGuess] = useState<number | null>(null)
  const run = useStore((s) => s.mission.run)
  const { apply, live } = useMemo(() => {
    const design = currentDesign()
    const content = getContent()
    if (!design) return { apply: null, live: {} as VizLive }
    try {
      return {
        apply: fillTemplate(lesson.applyTemplate, applyValues(design, content, run)),
        live: vizLive(design, content, run),
      }
    } catch {
      return { apply: null, live: {} as VizLive }
    }
  }, [lesson, run])
  const Viz = VIZ[lesson.viz]
  const q = lesson.predictQuestion

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/70"
      data-testid="nova-lesson"
      data-lesson={lesson.id}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lesson.title}
        className="relative max-h-[90vh] w-[min(46rem,94vw)] overflow-y-auto border border-border-strong bg-bg p-5 shadow-modal"
      >
        <header className="flex items-center gap-3">
          <NovaSprite size={48} talking={guess === null} />
          <div className="min-w-0">
            <p className="font-title text-xs tracking-widest text-accent uppercase">NOVA lesson</p>
            <h2 className="font-title text-2xl tracking-wide text-primary uppercase">
              {lesson.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeLesson}
            className={`${BTN} ml-auto border-border-strong text-muted hover:text-primary`}
            data-testid="nova-lesson-skip"
          >
            {guess === null ? 'Skip' : 'Done'}
          </button>
        </header>

        <section className="mt-4">
          <p className="text-primary">{q.question}</p>
          <ul className="mt-2 space-y-1.5">
            {q.options.slice(0, 3).map((o, i) => {
              const state =
                guess === null
                  ? ''
                  : i === q.correctIndex
                    ? 'border-success text-success'
                    : i === guess
                      ? 'border-danger text-danger'
                      : 'border-border text-subtle'
              return (
                <li key={o}>
                  <button
                    type="button"
                    disabled={guess !== null}
                    onClick={() => setGuess(i)}
                    className={`w-full border px-3 py-1.5 text-left text-sm ${state || 'border-border-strong text-primary hover:border-accent'} focus-visible:outline-2 focus-visible:outline-accent`}
                    data-testid={`nova-predict-${i}`}
                  >
                    {o}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {guess !== null && (
          <section className="mt-4 space-y-3" data-testid="nova-lesson-body">
            <p
              className={`font-title tracking-wide uppercase ${guess === q.correctIndex ? 'text-success' : 'text-alert'}`}
            >
              {guess === q.correctIndex ? 'Right!' : 'Not quite. Here is why:'}
            </p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
              {lesson.steps.slice(0, 4).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <Viz params={lesson.vizParams} live={live} />
            <p className="overflow-x-auto text-sm text-primary" data-testid="nova-formula">
              <InlineMath math={lesson.formulaLatex} />
            </p>
            <p
              className="border-l-2 border-alert pl-3 text-sm text-primary"
              data-testid="nova-apply"
            >
              <span className="font-title tracking-wide text-alert uppercase">
                Apply to your mission:{' '}
              </span>
              {apply ?? 'Plan a mission first and NOVA will use your numbers here.'}
            </p>
            <p className="font-mono text-xs text-subtle">
              Source:{' '}
              {lesson.source.startsWith('http') ? (
                <a
                  href={lesson.source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  {lesson.source}
                </a>
              ) : (
                <span className="text-alert">{lesson.source}</span>
              )}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
