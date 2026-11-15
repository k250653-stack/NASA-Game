import type { Series } from './debrief'

/** Chart size in SVG units; it scales to the column width. */
const W = 520
const H = 150
const PAD = 6

const STROKE: Record<string, string> = {
  alert: 'stroke-alert',
  accent: 'stroke-accent',
  success: 'stroke-success',
  'role-science': 'stroke-role-science',
}
const SWATCH: Record<string, string> = {
  alert: 'bg-alert',
  accent: 'bg-accent',
  success: 'bg-success',
  'role-science': 'bg-role-science',
}

/** Key resources over the mission days: thin straight lines, each scaled to its own peak. */
export function MissionGraph({ series, days }: { series: readonly Series[]; days: number }) {
  const x = (d: number) => PAD + (d / Math.max(1, days)) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - v * (H - 2 * PAD)
  return (
    <figure data-testid="mission-graph">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full border border-border bg-surface"
        role="img"
        aria-label="Resources over the mission"
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={PAD}
            x2={W - PAD}
            y1={y(g)}
            y2={y(g)}
            className="stroke-border"
            strokeWidth="1"
            shapeRendering="crispEdges"
          />
        ))}
        {series.map((s) => (
          <polyline
            key={s.id}
            fill="none"
            className={STROKE[s.color]}
            strokeWidth="1.5"
            strokeLinejoin="miter"
            shapeRendering="crispEdges"
            points={[[0, s.points[0]?.[1] ?? 0] as const, ...s.points]
              .map(([d, v]) => `${x(d)},${y(v)}`)
              .join(' ')}
          />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span className={`inline-block size-2 ${SWATCH[s.color]}`} />
            {s.label}{' '}
            <span className="text-subtle tabular-nums">
              (peak {Math.round(s.max).toLocaleString('en-US')} {s.unit})
            </span>
          </span>
        ))}
        <span className="text-subtle">Day 0 – {days}</span>
      </figcaption>
    </figure>
  )
}
