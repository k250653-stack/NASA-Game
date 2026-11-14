import type { ReactNode } from 'react'

interface PanelProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** Buttons or controls shown on the right of the header. */
  actions?: ReactNode
  children?: ReactNode
  /** Inner padding on the body (default true). */
  padded?: boolean
  className?: string
}

/** Flat titled container: the basic building block of every screen. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  className = '',
}: PanelProps) {
  const hasHeader = title !== undefined || actions !== undefined
  return (
    <section className={`rounded-lg border border-border bg-panel shadow-panel ${className}`}>
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title !== undefined && (
              <h2 className="font-display text-sm font-semibold tracking-[0.14em] text-primary uppercase">
                {title}
              </h2>
            )}
            {subtitle !== undefined && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions !== undefined && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  )
}
