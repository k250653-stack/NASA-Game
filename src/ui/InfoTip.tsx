import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'

/** Small pixel "i": secondary details on hover or keyboard focus instead of always on screen. */
export function InfoTip({
  children,
  label = 'More info',
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <Tooltip content={children} side="bottom">
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 shrink-0 items-center justify-center border-2 border-border-strong font-mono text-xs leading-none text-muted hover:border-accent hover:text-accent"
      >
        i
      </button>
    </Tooltip>
  )
}
