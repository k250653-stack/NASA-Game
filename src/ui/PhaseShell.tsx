import type { ReactNode } from 'react'
import { PHASES, phaseIndex, useStore } from '@/store'
import { Button } from './Button'

interface PhaseShellProps {
  title: string
  description: string
  children?: ReactNode
  /** Hide the Back button (used on the title screen). */
  hideBack?: boolean
  nextLabel?: string
  backLabel?: string
}

/**
 * Shared layout for every screen stub: phase name, one-line description, Back/Next.
 * Navigation is just the store's phase; there is no router.
 */
export function PhaseShell({
  title,
  description,
  children,
  hideBack = false,
  nextLabel = 'Next',
  backLabel = 'Back',
}: PhaseShellProps) {
  const phase = useStore((s) => s.game.phase)
  const nextPhase = useStore((s) => s.nextPhase)
  const prevPhase = useStore((s) => s.prevPhase)
  const setPhase = useStore((s) => s.setPhase)

  const index = phaseIndex(phase)
  const isFirst = index === 0
  const isLast = index === PHASES.length - 1

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-10">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          Phase {index + 1} / {PHASES.length} · {phase}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-50">{title}</h1>
        <p className="mt-3 text-base text-slate-400">{description}</p>
      </header>

      <section className="flex-1 rounded-lg border border-space-700 bg-space-900/70 p-6 shadow-inner">
        {children ?? (
          <p className="text-sm text-slate-500">
            Screen stub. Gameplay for this phase has not been built yet.
          </p>
        )}
      </section>

      <footer className="mt-8 flex items-center justify-between">
        <div>
          {!hideBack && !isFirst && (
            <Button variant="ghost" onClick={prevPhase}>
              ← {backLabel}
            </Button>
          )}
        </div>
        <ol className="hidden gap-1.5 sm:flex" aria-label="Phase progress">
          {PHASES.map((p, i) => (
            <li key={p}>
              <button
                type="button"
                title={p}
                onClick={() => setPhase(p)}
                className={`block h-2 w-2 rounded-full transition ${
                  i === index ? 'bg-accent' : i < index ? 'bg-accent/40' : 'bg-space-500'
                }`}
              />
            </li>
          ))}
        </ol>
        <div>
          {isLast ? (
            <Button onClick={() => setPhase('title')}>Back to title</Button>
          ) : (
            <Button onClick={nextPhase}>{nextLabel} →</Button>
          )}
        </div>
      </footer>
    </main>
  )
}
