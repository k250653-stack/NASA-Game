import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useUi } from './uiStore'

interface CollapsibleProps {
  title: string
  children: ReactNode
  /** Open on first render (default true). */
  defaultOpen?: boolean
  /** DOM id; opening "Fix in Planning" for this id also expands it. */
  id?: string
  testId?: string
  /** Short text on the right of the header, e.g. "5 / 12 days". */
  summary?: ReactNode
}

/** A pixel panel whose body folds away; the header is the toggle button. */
export function Collapsible({
  title,
  children,
  defaultOpen = true,
  id,
  testId,
  summary,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  const focusPanel = useUi((s) => s.focusPanel)
  useEffect(() => {
    if (id && focusPanel === id) setOpen(true)
  }, [id, focusPanel])

  return (
    <section id={id} data-testid={testId} tabIndex={id ? -1 : undefined} className="pixel-panel">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left"
      >
        <Icon name={open ? 'IconMinus' : 'IconPlus'} size={14} className="shrink-0 text-muted" />
        <h2 className="label-caps min-w-0 flex-1 truncate text-base text-primary">{title}</h2>
        {summary !== undefined && (
          <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{summary}</span>
        )}
      </button>
      {open && <div className="min-w-0 border-t-2 border-border p-3">{children}</div>}
    </section>
  )
}
