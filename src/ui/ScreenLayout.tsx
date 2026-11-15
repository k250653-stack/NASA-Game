import type { ReactNode } from 'react'
import { useStore } from '@/store'
import { Icon } from './Icon'
import { ProgressSteps } from './ProgressSteps'
import { SoundToggle } from './SoundToggle'
import { usePopup } from './popupContext'

interface ScreenLayoutProps {
  children: ReactNode
  /** Right column, e.g. resource bars. */
  sidebar?: ReactNode
  /** Bottom row inside the content area, e.g. Back/Next. */
  footer?: ReactNode
  /** Hide the phase stepper (title screen). */
  showSteps?: boolean
  /** Extra content at the right of the top bar. */
  topBarExtra?: ReactNode
}

/** Every screen sits inside this: top bar (title, stepper, sound), content, optional sidebar. */
export function ScreenLayout({
  children,
  sidebar,
  footer,
  showSteps = true,
  topBarExtra,
}: ScreenLayoutProps) {
  const phase = useStore((s) => s.game.phase)
  const setPhase = useStore((s) => s.setPhase)
  // Inside a world popup the popup frame is the chrome: no top bar.
  const inPopup = usePopup() !== null

  return (
    <div className="flex min-h-full flex-col">
      {!inPopup && (
        <header className="sticky top-0 z-30 h-topbar shrink-0 border-b-2 border-border bg-surface">
          <div className="mx-auto flex h-full max-w-content items-center gap-6 px-6">
            <button
              type="button"
              onClick={() => setPhase('title')}
              className="label-caps flex shrink-0 items-center gap-2 text-base text-primary"
            >
              <Icon name="IconRocket" size={20} className="text-accent" />
              Mission Control
            </button>
            <nav className="flex min-w-0 flex-1 justify-center">
              {showSteps && <ProgressSteps current={phase} compact={topBarExtra !== undefined} />}
            </nav>
            {topBarExtra}
            <SoundToggle />
          </div>
        </header>
      )}

      <div
        className={`mx-auto grid w-full max-w-content flex-1 gap-6 px-6 ${inPopup ? 'py-4' : 'py-6'} ${
          sidebar ? 'grid-cols-[minmax(0,1fr)_var(--spacing-sidebar)]' : 'grid-cols-1'
        }`}
      >
        <main className="flex min-w-0 flex-col gap-6">
          {children}
          {footer && <div className="mt-auto">{footer}</div>}
        </main>
        {sidebar && <aside className="flex flex-col gap-4">{sidebar}</aside>}
      </div>
    </div>
  )
}
