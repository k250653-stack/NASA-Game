import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip'

interface PanelProps {
  title?: ReactNode
  /** Secondary detail: shown behind an "i" tip next to the title, not as a second line. */
  subtitle?: ReactNode
  /** Buttons or controls shown on the right of the header. */
  actions?: ReactNode
  children?: ReactNode
  /** Inner padding on the body (default true). */
  padded?: boolean
  className?: string
  /** DOM id, e.g. for focusing a panel from another screen. */
  id?: string
  testId?: string
}

/** Pixel panel: dark navy, 2px steel border, notched corners, condensed caps title. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  className = '',
  id,
  testId,
}: PanelProps) {
  const hasHeader = title !== undefined || actions !== undefined
  return (
    <section
      id={id}
      data-testid={testId}
      tabIndex={id ? -1 : undefined}
      className={`pixel-panel ${className}`}
    >
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 border-b-2 border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {title !== undefined && (
              <h2 className="label-caps truncate text-base text-primary">{title}</h2>
            )}
            {subtitle !== undefined && <InfoTip>{subtitle}</InfoTip>}
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
