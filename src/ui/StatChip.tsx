import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { TONE_TEXT, type Tone } from './tones'

interface StatChipProps {
  /** Tabler icon name, e.g. "IconWeight". */
  icon?: string
  label: string
  value: ReactNode
  unit?: string
  tone?: Tone
  className?: string
  testId?: string
}

/** Icon + label + monospace value. Values use tabular numbers so they never jump. */
export function StatChip({
  icon,
  label,
  value,
  unit,
  tone = 'neutral',
  className = '',
  testId,
}: StatChipProps) {
  return (
    <div
      data-testid={testId}
      className={`inline-flex items-center gap-2 border-2 border-border bg-surface px-2.5 py-1 ${className}`}
    >
      {icon && <Icon name={icon} size={16} className="text-muted" />}
      <span className="label-caps text-xs text-muted">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${TONE_TEXT[tone]}`}>
        {value}
        {unit && <span className="ml-0.5 text-subtle">{unit}</span>}
      </span>
    </div>
  )
}
