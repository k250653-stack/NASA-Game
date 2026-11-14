import type { Priorities } from '@/schemas'

const SEGMENTS: Array<{ key: keyof Priorities; label: string; fill: string; text: string }> = [
  { key: 'science', label: 'Science', fill: 'bg-accent', text: 'text-accent' },
  { key: 'safety', label: 'Safety', fill: 'bg-success', text: 'text-success' },
  { key: 'cost', label: 'Cost', fill: 'bg-alert', text: 'text-alert' },
]

/** Stacked bar of what this crew member cares about (science / safety / cost, sums to 1). */
export function PrioritiesBar({ priorities }: { priorities: Priorities }) {
  return (
    <div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full border border-border"
        role="img"
        aria-label={SEGMENTS.map((s) => `${s.label} ${Math.round(priorities[s.key] * 100)}%`).join(
          ', ',
        )}
      >
        {SEGMENTS.map((s) => (
          <span key={s.key} className={s.fill} style={{ width: `${priorities[s.key] * 100}%` }} />
        ))}
      </div>
      <div className="mt-1 flex gap-4 font-mono text-xs">
        {SEGMENTS.map((s) => (
          <span key={s.key} className={s.text}>
            {s.label} {Math.round(priorities[s.key] * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}
