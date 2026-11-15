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
  /** Smaller padding and text, for dense cards. */
  compact?: boolean
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
  compact = false,
  className = '',
  testId,
}: StatChipProps) {
  return (
    <div
      data-testid={testId}
      className={`inline-flex items-center border-2 border-border bg-surface ${compact ? 'gap-1.5 px-2 py-0.5' : 'gap-2 px-2.5 py-1'} ${className}`}
    >
      {icon && <Icon name={icon} size={compact ? 14 : 16} className="text-muted" />}
      <span className="label-caps text-xs text-muted">{label}</span>
      <span className={`font-mono tabular-nums ${compact ? 'ml-auto text-xs' : 'text-sm'} ${TONE_TEXT[tone]}`}>
        {value}
        {unit && <span className="ml-0.5 text-subtle">{unit}</span>}
      </span>
    </div>
  )
}
