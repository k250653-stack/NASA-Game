import type { ReactNode } from 'react'
import { useStore } from '@/store'
import { Icon } from '@/ui/Icon'
import { PopupContext } from '@/ui/popupContext'

interface PopupPanelProps {
  children: ReactNode
  /** Shows the × button. Omit for popups that need an answer (mission events). */
  onClose?: () => void
  /**
   * Title bar text after the section, e.g. "Recruit crew". Omit when the screen inside draws
   * its own title bar (phase screens do, via PhaseShell).
   */
  title?: string
  /** Section before the title, e.g. "Personnel" -> "PERSONNEL · RECRUIT CREW". */
  section?: string
  /** Kept for callers; every popup now uses the same size. */
  size?: 'full' | 'compact'
  label?: string
}

/**
 * Every popup over the world: ~92% of the screen, centred, pixel frame, one title bar, × in the
 * top-right corner. Esc closing is handled by the world (HQWorld / HabitatWorld) so in-screen
 * modals close first. Each screen gets a fresh scroll position.
 */
export function PopupPanel({ children, onClose, title, section, label }: PopupPanelProps) {
  const phase = useStore((s) => s.game.phase)
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/70"
      data-testid="world-popup"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title ?? section ?? 'Station'}
        className="pixel-panel flex h-[92vh] w-[92vw] flex-col"
      >
        {title && (
          <header className="flex h-12 shrink-0 items-center border-b-2 border-border px-5 pr-14">
            <h2 className="label-caps truncate text-xl text-primary">
              {section && <span className="text-accent">{section} · </span>}
              {title}
            </h2>
          </header>
        )}
        <div key={phase} className="min-h-0 flex-1 overflow-y-auto">
          <PopupContext.Provider value={{ section: section ?? null }}>
            {children}
          </PopupContext.Provider>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="popup-close"
            className="absolute top-2 right-2 z-10 flex size-8 items-center justify-center border-2 border-border-strong bg-panel text-muted hover:border-accent hover:text-accent"
          >
            <Icon name="IconX" size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
