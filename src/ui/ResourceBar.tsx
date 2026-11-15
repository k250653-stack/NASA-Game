import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './Icon'
import { SegmentBar } from './SegmentBar'
import { TONE_FILL, TONE_TEXT, type Tone } from './tones'

interface ResourceBarProps {
  label: string
  /** Tabler icon name. */
  icon?: string
  value: number
  max: number
  unit?: string
  /** Value at which the bar turns amber. */
  warnAt?: number
  /** Value at which the bar turns red. */
  dangerAt?: number
  /**
   * 'depleting' (default): low is bad, e.g. power, water.
   * 'filling': high is bad, e.g. mass used vs rocket capacity.
   */
  mode?: 'depleting' | 'filling'
  decimals?: number
  /** Custom number text (e.g. "600k"); replaces the default formatting. */
  format?: (n: number) => string
  /** Overrides the thresholds with the engine's verdict. */
  status?: 'ok' | 'warn' | 'fail'
}

/** How long the "+/-" delta stays visible after a change, in ms. */
const DELTA_VISIBLE_MS = 1400

function statusOf(
  value: number,
  warnAt: number | undefined,
  dangerAt: number | undefined,
  filling: boolean,
): Tone {
  const past = (t: number | undefined) => t !== undefined && (filling ? value >= t : value <= t)
  if (past(dangerAt)) return 'danger'
  if (past(warnAt)) return 'alert'
  return 'accent'
}

export function ResourceBar({
  label,
  icon,
  value,
  max,
  unit,
  warnAt,
  dangerAt,
  mode = 'depleting',
  decimals = 0,
  format,
  status: statusOverride,
}: ResourceBarProps) {
  const id = useId()
  const status: Tone = statusOverride
    ? ({ ok: 'accent', warn: 'alert', fail: 'danger' } as const)[statusOverride]
    : statusOf(value, warnAt, dangerAt, mode === 'filling')
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const fmt = (n: number) =>
    format
      ? format(n)
      : n.toLocaleString(undefined, {
          maximumFractionDigits: decimals,
          minimumFractionDigits: decimals,
        })

  // Track the previous value during render (React's recommended pattern) to show a delta.
  const [prev, setPrev] = useState(value)
  const [delta, setDelta] = useState<{ amount: number; key: number } | null>(null)
  if (value !== prev) {
    setPrev(value)
    setDelta({ amount: value - prev, key: (delta?.key ?? 0) + 1 })
  }
  useEffect(() => {
    if (!delta) return
    const t = setTimeout(() => setDelta(null), DELTA_VISIBLE_MS)
    return () => clearTimeout(t)
  }, [delta])

  const tick = (t: number | undefined) =>
    t !== undefined && max > 0 ? (
      <span
        aria-hidden
        className="absolute -top-0.5 h-3.5 w-0.5 bg-primary"
        style={{ left: `${Math.min(100, (t / max) * 100)}%` }}
      />
    ) : null

  return (
    <div className="w-full">
      <div className="mb-1 flex min-w-0 items-center gap-2">
        {icon && (
          <Icon
            name={icon}
            size={16}
            className={TONE_TEXT[status === 'accent' ? 'neutral' : status]}
          />
        )}
        <span id={id} className="label-caps min-w-0 truncate text-sm text-muted">
          {label}
        </span>
        <span className="relative ml-auto font-mono text-sm whitespace-nowrap tabular-nums">
          <AnimatePresence>
            {delta && delta.amount !== 0 && (
              <motion.span
                key={delta.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`absolute right-0 bottom-full mb-0.5 text-xs leading-none ${delta.amount > 0 ? 'text-success' : 'text-danger'}`}
              >
                {delta.amount > 0 ? '+' : '−'}
                {fmt(Math.abs(delta.amount))}
              </motion.span>
            )}
          </AnimatePresence>
          <span className={TONE_TEXT[status === 'accent' ? 'neutral' : status]}>{fmt(value)}</span>
          <span className="text-subtle">
            {' / '}
            {fmt(max)}
            {unit && ` ${unit}`}
          </span>
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${fmt(value)} of ${fmt(max)}${unit ? ` ${unit}` : ''}`}
        className="relative"
      >
        <SegmentBar share={pct / 100} fill={TONE_FILL[status]} />
        {tick(warnAt)}
        {tick(dangerAt)}
      </div>
    </div>
  )
}
