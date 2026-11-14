import type { ReactNode } from 'react'
import { PHASES, phaseIndex, useStore } from '@/store'
import { Button } from './Button'
import { Panel } from './Panel'
import { ScreenLayout } from './ScreenLayout'

interface PhaseShellProps {
  title: string
  description: string
  children?: ReactNode
  sidebar?: ReactNode
  nextLabel?: string
  backLabel?: string
}

/** Layout for phase screens: heading, main panel, Back/Next. Navigation is the store's phase. */
export function PhaseShell({
  title,
  description,
  children,
  sidebar,
  nextLabel = 'Next',
  backLabel = 'Back',
}: PhaseShellProps) {
  const phase = useStore((s) => s.game.phase)
  const nextPhase = useStore((s) => s.nextPhase)
  const prevPhase = useStore((s) => s.prevPhase)
  const setPhase = useStore((s) => s.setPhase)

  const index = phaseIndex(phase)
  const isLast = index === PHASES.length - 1

  const footer = (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <Button variant="secondary" onClick={prevPhase}>
        ← {backLabel}
      </Button>
      {isLast ? (
        <Button onClick={() => setPhase('title')}>Back to title</Button>
      ) : (
        <Button onClick={nextPhase}>{nextLabel} →</Button>
      )}
    </div>
  )

  return (
    <ScreenLayout sidebar={sidebar} footer={footer}>
      <div>
        <p className="font-mono text-xs tracking-[0.3em] text-accent uppercase">
          Phase {index + 1} / {PHASES.length} · {phase}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-primary">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-base text-muted">{description}</p>
      </div>
      <Panel title="Status" subtitle="Screen stub">
        {children ?? (
          <p className="text-sm text-muted">Gameplay for this phase has not been built yet.</p>
        )}
      </Panel>
    </ScreenLayout>
  )
}
