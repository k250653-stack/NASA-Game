import type { ReactNode } from 'react'
import { PHASES, phaseIndex, useStore } from '@/store'
import { Button } from './Button'
import { InfoTip } from './InfoTip'
import { usePopup } from './popupContext'
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
  /** Extra content in the top bar. */
  topBarExtra?: ReactNode
  nextLabel?: string
  backLabel?: string
  /** Disables Continue; nextHint explains why. */
  nextDisabled?: boolean
  /** Replaces the default "go to the next phase" (e.g. Launch). */
  onNext?: () => void
  nextHint?: string
}

/** Layout for phase screens: heading, content, Back/Next. Navigation is the store's phase. */
export function PhaseShell({
  title,
  description,
  children,
  sidebar,
  headerAside,
  topBarExtra,
  nextLabel = 'Next',
  backLabel = 'Back',
  nextDisabled = false,
  nextHint,
  onNext,
}: PhaseShellProps) {
  const phase = useStore((s) => s.game.phase)
  const nextPhase = useStore((s) => s.nextPhase)
  const prevPhase = useStore((s) => s.prevPhase)
  const setPhase = useStore((s) => s.setPhase)
  const popup = usePopup()

  const index = phaseIndex(phase)
  const isLast = index === PHASES.length - 1

  const footer = (
    <div
      className={`flex items-start justify-between gap-6 border-t-2 border-border pt-4 ${popup ? 'sticky bottom-0 z-20 -mb-4 bg-panel pb-3' : ''}`}
    >
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
            onClick={onNext ?? nextPhase}
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
    <ScreenLayout sidebar={sidebar} footer={footer} topBarExtra={topBarExtra}>
      {/* Title bar: "PERSONNEL · RECRUIT CREW" in a popup, "PHASE 4 / 10 · RECRUIT" on its own. */}
      <div
        className={`flex items-center justify-between gap-4 border-b-2 border-border pb-3 ${popup ? 'pr-10' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="label-caps truncate text-2xl text-primary">
            <span className="text-accent">
              {popup?.section ?? `Phase ${index + 1} / ${PHASES.length}`} ·{' '}
            </span>
            {title}
          </h1>
          <InfoTip label={`About ${title}`}>{description}</InfoTip>
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
