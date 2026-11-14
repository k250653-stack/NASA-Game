import type { ReactNode } from 'react'
import { PHASES, phaseIndex, useStore } from '@/store'
import { Button } from './Button'
import { Panel } from './Panel'
import { ScreenLayout } from './ScreenLayout'

interface PhaseShellProps {
  title: string
  description: string
  /** Screen content. Without it, a "not built yet" stub panel is shown. */
  children?: ReactNode
  sidebar?: ReactNode
  /** Small content at the top right of the heading (e.g. the seed). */
  headerAside?: ReactNode
  nextLabel?: string
  backLabel?: string
  /** Disables Continue; nextHint explains why. */
  nextDisabled?: boolean
  nextHint?: string
}

/** Layout for phase screens: heading, content, Back/Next. Navigation is the store's phase. */
export function PhaseShell({
  title,
  description,
  children,
  sidebar,
  headerAside,
  nextLabel = 'Next',
  backLabel = 'Back',
  nextDisabled = false,
  nextHint,
}: PhaseShellProps) {
  const phase = useStore((s) => s.game.phase)
  const nextPhase = useStore((s) => s.nextPhase)
  const prevPhase = useStore((s) => s.prevPhase)
  const setPhase = useStore((s) => s.setPhase)

  const index = phaseIndex(phase)
  const isLast = index === PHASES.length - 1

  const footer = (
    <div className="flex items-start justify-between gap-6 border-t border-border pt-4">
      <Button variant="secondary" onClick={prevPhase} data-testid="back-button">
        ← {backLabel}
      </Button>
      <div className="flex flex-col items-end gap-2">
        {isLast ? (
          <Button onClick={() => setPhase('title')} data-testid="next-button">
            Back to title
          </Button>
        ) : (
          <Button
            onClick={nextPhase}
            data-testid="next-button"
            disabled={nextDisabled}
            aria-describedby={nextHint ? 'next-hint' : undefined}
          >
            {nextLabel} →
          </Button>
        )}
        {nextHint && (
          <p id="next-hint" className="max-w-md text-right text-sm text-alert">
            {nextHint}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <ScreenLayout sidebar={sidebar} footer={footer}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent uppercase">
            Phase {index + 1} / {PHASES.length} · {phase}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-primary">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-base text-muted">{description}</p>
        </div>
        {headerAside}
      </div>
      {children ?? (
        <Panel title="Status" subtitle="Screen stub">
          <p className="text-sm text-muted">Gameplay for this phase has not been built yet.</p>
        </Panel>
      )}
    </ScreenLayout>
  )
}
