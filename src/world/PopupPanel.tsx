import type { ReactNode } from 'react'
import { useStore } from '@/store'
import { Icon } from '@/ui/Icon'

/**
 * A station's screens in a large panel over the room (dimmed behind). Each screen gets a fresh
 * scroll position. Esc closing is handled by HQWorld (so in-screen modals close first).
 */
export function PopupPanel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const phase = useStore((s) => s.game.phase)
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60"
      data-testid="world-popup"
    >
      <div role="dialog" aria-modal="true" aria-label="Station" className="relative h-[92vh] w-[92vw]">
        <div
          key={phase}
          className="size-full overflow-y-auto rounded-xl border border-border-strong bg-bg shadow-modal"
        >
          {children}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-testid="popup-close"
          className="absolute -top-3 -right-3 z-40 flex size-9 items-center justify-center rounded-full border border-border-strong bg-panel-raised text-muted hover:text-primary"
        >
          <Icon name="IconX" size={18} />
        </button>
      </div>
    </div>
  )
}
