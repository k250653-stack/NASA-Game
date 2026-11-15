import type { ReactNode } from 'react'
import { useStore } from '@/store'
import { Icon } from '@/ui/Icon'

interface PopupPanelProps {
  children: ReactNode
  /** Shows the × button. Omit for popups that need an answer (mission events). */
  onClose?: () => void
  /** "full" for station screens, "compact" for small habitat popups. */
  size?: 'full' | 'compact'
  label?: string
}

/**
 * A panel over the room (dimmed behind). Each screen gets a fresh scroll position. Esc closing
 * is handled by the world (HQWorld / HabitatWorld) so in-screen modals close first.
 */
export function PopupPanel({
  children,
  onClose,
  size = 'full',
  label = 'Station',
}: PopupPanelProps) {
  const phase = useStore((s) => s.game.phase)
  const box = size === 'full' ? 'h-[92vh] w-[92vw]' : 'max-h-[86vh] w-[min(40rem,92vw)]'
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60"
      data-testid="world-popup"
    >
      <div role="dialog" aria-modal="true" aria-label={label} className={`relative ${box}`}>
        <div
          key={phase}
          className={`overflow-y-auto border border-border-strong bg-bg shadow-modal ${size === 'full' ? 'size-full rounded-xl' : 'max-h-[86vh] rounded-none'}`}
        >
          {children}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="popup-close"
            className="absolute -top-3 -right-3 z-40 flex size-9 items-center justify-center rounded-full border border-border-strong bg-panel-raised text-muted hover:text-primary"
          >
            <Icon name="IconX" size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
