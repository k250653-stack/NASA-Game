import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './Icon'
import { useUi, type ToastItem, type ToastKind } from './uiStore'

/** How long a toast stays before closing itself, in ms. Danger toasts stay until closed. */
const AUTO_CLOSE_MS = 5000

const KIND: Record<ToastKind, { icon: string; text: string; border: string }> = {
  info: { icon: 'IconInfoCircle', text: 'text-accent', border: 'border-l-accent' },
  warning: { icon: 'IconAlertTriangle', text: 'text-alert', border: 'border-l-alert' },
  danger: { icon: 'IconAlertOctagon', text: 'text-danger', border: 'border-l-danger' },
  success: { icon: 'IconCircleCheck', text: 'text-success', border: 'border-l-success' },
}

/**
 * Stacked notifications, top-right under the top bar (never over the Back/Next footer).
 * Push with toast.info(...) from uiStore.
 */
export function Toaster() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div
      data-overlay
      className="pointer-events-none fixed top-[calc(var(--spacing-topbar)+1rem)] right-6 z-[60] flex w-96 flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastView({ toast }: { toast: ToastItem }) {
  const dismiss = useUi((s) => s.dismissToast)
  const k = KIND[toast.kind]

  useEffect(() => {
    if (toast.kind === 'danger') return
    const t = setTimeout(() => dismiss(toast.id), AUTO_CLOSE_MS)
    return () => clearTimeout(t)
  }, [toast.id, toast.kind, dismiss])

  return (
    <motion.div
      layout
      role={toast.kind === 'danger' ? 'alert' : 'status'}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
      className={`pointer-events-auto flex gap-3 rounded-md border border-l-4 border-border-strong ${k.border} bg-panel-raised p-3 shadow-modal`}
    >
      <Icon name={k.icon} size={20} className={`mt-0.5 shrink-0 ${k.text}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-sm text-muted">{toast.message}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              dismiss(toast.id)
            }}
            className="mt-2 rounded-sm text-sm font-semibold text-accent hover:text-accent-strong"
          >
            {toast.action.label} →
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="h-fit rounded-sm p-0.5 text-muted hover:text-primary"
      >
        <Icon name="IconX" size={16} />
      </button>
    </motion.div>
  )
}
