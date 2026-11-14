import type { ReactNode } from 'react'
import { useStore } from '@/store'
import { Icon } from './Icon'
import { ProgressSteps } from './ProgressSteps'
import { SoundToggle } from './SoundToggle'

interface ScreenLayoutProps {
  children: ReactNode
  /** Right column, e.g. resource bars. */
  sidebar?: ReactNode
  /** Bottom row inside the content area, e.g. Back/Next. */
  footer?: ReactNode
  /** Hide the phase stepper (title screen). */
  showSteps?: boolean
}

/** Every screen sits inside this: top bar (title, stepper, sound), content, optional sidebar. */
export function ScreenLayout({ children, sidebar, footer, showSteps = true }: ScreenLayoutProps) {
  const phase = useStore((s) => s.game.phase)
  const setPhase = useStore((s) => s.setPhase)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 h-topbar shrink-0 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-full max-w-content items-center gap-6 px-6">
          <button
            type="button"
            onClick={() => setPhase('title')}
            className="flex shrink-0 items-center gap-2 rounded-md font-display text-sm font-bold tracking-[0.2em] text-primary uppercase"
          >
            <Icon name="IconRocket" size={20} className="text-accent" />
            Mission Control
          </button>
          <nav className="flex min-w-0 flex-1 justify-center">
            {showSteps && <ProgressSteps current={phase} />}
          </nav>
          <SoundToggle />
        </div>
      </header>

      <div
        className={`mx-auto grid w-full max-w-content flex-1 gap-6 px-6 py-6 ${
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
