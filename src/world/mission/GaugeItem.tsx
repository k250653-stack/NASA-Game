import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '@/ui/Icon'
import { SegmentBar } from '@/ui/SegmentBar'
import type { Gauge } from './missionRun'

const BAR: Record<Gauge['status'], string> = {
  ok: 'bg-accent',
  low: 'bg-alert',
  critical: 'bg-danger',
}
/** A drop of at least this share in one turn flashes the bar red. */
const BIG_DROP = 0.15
/** Changes smaller than this (share) show no floating number. */
const MIN_DELTA = 0.01
const DELTA_MS = 1400

/** One HUD resource bar: flashes on a big drop, and a small +/- floats up when it changes. */
export function GaugeItem({ g }: { g: Gauge }) {
  // Track the previous value during render (React's recommended pattern).
  const [prev, setPrev] = useState(g.share)
  const [change, setChange] = useState<{ d: number; key: number } | null>(null)
  if (g.share !== prev) {
    setPrev(g.share)
    const d = g.share - prev
    if (Math.abs(d) >= MIN_DELTA) setChange({ d, key: (change?.key ?? 0) + 1 })
  }
  useEffect(() => {
    if (!change) return
    const t = setTimeout(() => setChange(null), DELTA_MS)
    return () => clearTimeout(t)
  }, [change])
  const flash = change !== null && change.d <= -BIG_DROP
  return (
    <li
      title={`${g.label}: ${g.value}`}
      className="relative flex items-center gap-2"
      data-testid={`gauge-${g.id}`}
      data-status={g.status}
    >
      <Icon
        name={g.icon}
        size={14}
        className={
          g.status === 'ok' ? 'text-muted' : g.status === 'low' ? 'text-alert' : 'text-danger'
        }
      />
      <span className="label-caps w-14 text-xs text-muted">{g.label}</span>
      <span key={flash ? change?.key : 'steady'} className={`w-24 ${flash ? 'bar-flash' : ''}`}>
        <SegmentBar share={g.share} fill={BAR[g.status]} segments={10} />
      </span>
      <AnimatePresence>
        {change && (
          <motion.span
            key={change.key}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: -10 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`pointer-events-none absolute -top-1 right-0 font-mono text-xs tabular-nums ${change.d > 0 ? 'text-success' : 'text-danger'}`}
            aria-hidden
          >
            {change.d > 0 ? '+' : '−'}
            {Math.round(Math.abs(change.d) * 100)}%
          </motion.span>
        )}
      </AnimatePresence>
    </li>
  )
}
