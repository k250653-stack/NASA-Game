import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './Icon'
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
}: ResourceBarProps) {
  const id = useId()
  const status = statusOf(value, warnAt, dangerAt, mode === 'filling')
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
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
        className="absolute top-0 h-full w-px bg-border-strong"
        style={{ left: `${Math.min(100, (t / max) * 100)}%` }}
      />
    ) : null

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center gap-2">
        {icon && (
          <Icon
            name={icon}
            size={16}
            className={TONE_TEXT[status === 'accent' ? 'neutral' : status]}
          />
        )}
        <span id={id} className="text-xs font-medium tracking-wide text-muted uppercase">
          {label}
        </span>
        <span className="relative ml-auto font-mono text-sm tabular-nums">
          <AnimatePresence>
            {delta && delta.amount !== 0 && (
              <motion.span
                key={delta.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`absolute right-full mr-2 text-xs ${delta.amount > 0 ? 'text-success' : 'text-danger'}`}
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
        className="relative h-2 overflow-hidden rounded-full border border-border bg-surface"
      >
        <motion.div
          className={`h-full rounded-full ${TONE_FILL[status]}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        />
        {tick(warnAt)}
        {tick(dangerAt)}
      </div>
    </div>
  )
}
