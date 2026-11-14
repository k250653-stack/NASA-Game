import { motion } from 'motion/react'
import type { Destination } from '@/schemas'

interface TransitMapProps {
  destination: Destination
  /** 0-1 progress through the whole mission timeline. */
  progress: number
  durationS: number
}

/** Points on the quadratic arc from Earth to the destination, for the moving dot. */
const ARC = { x0: 90, y0: 210, cx: 400, cy: 30, x1: 710, y1: 210 }
function arcPoint(t: number): [number, number] {
  const u = 1 - t
  return [
    u * u * ARC.x0 + 2 * u * t * ARC.cx + t * t * ARC.x1,
    u * u * ARC.y0 + 2 * u * t * ARC.cy + t * t * ARC.y1,
  ]
}
const SAMPLES = Array.from({ length: 21 }, (_, i) => arcPoint(i / 20))

/** Earth → destination with a dot following the arc, and the mission phases listed with days. */
export function TransitMap({ destination, progress, durationS }: TransitMapProps) {
  const total = destination.phases.reduce((a, p) => a + p.days, 0)
  const phases = destination.phases.map((p, i) => {
    const before = destination.phases.slice(0, i).reduce((a, q) => a + q.days, 0)
    return { ...p, from: before / total, to: (before + p.days) / total }
  })
  const isMars = destination.id === 'mars'
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6" data-testid="transit-map">
      <svg
        viewBox="0 0 800 290"
        className="w-full"
        role="img"
        aria-label={`Trajectory from Earth to ${destination.name}`}
      >
        <path
          d={`M ${ARC.x0} ${ARC.y0} Q ${ARC.cx} ${ARC.cy} ${ARC.x1} ${ARC.y1}`}
          className="fill-none stroke-border-strong"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        <circle
          cx={ARC.x0}
          cy={ARC.y0}
          r="34"
          className="fill-accent/30 stroke-accent"
          strokeWidth="2"
        />
        <text x={ARC.x0} y={ARC.y0 + 56} textAnchor="middle" className="fill-muted text-[14px]">
          Earth
        </text>
        <circle
          cx={ARC.x1}
          cy={ARC.y1}
          r={isMars ? 26 : 18}
          className={isMars ? 'fill-danger/40 stroke-danger' : 'fill-muted/40 stroke-muted'}
          strokeWidth="2"
        />
        <text x={ARC.x1} y={ARC.y1 + 50} textAnchor="middle" className="fill-muted text-[14px]">
          {destination.name}
        </text>
        <motion.circle
          r="7"
          className="fill-alert"
          initial={{ cx: SAMPLES[0]![0], cy: SAMPLES[0]![1] }}
          animate={{ cx: SAMPLES.map((p) => p[0]), cy: SAMPLES.map((p) => p[1]) }}
          transition={{ duration: durationS, ease: 'linear' }}
        />
      </svg>
      <ol className="flex flex-wrap justify-center gap-3">
        {phases.map((p) => {
          const active = progress >= p.from && progress < p.to
          const done = progress >= p.to
          return (
            <li
              key={p.id}
              className={`rounded-md border px-3 py-1.5 font-mono text-sm ${
                active
                  ? 'border-accent bg-accent/10 text-accent'
                  : done
                    ? 'border-border text-muted'
                    : 'border-border text-subtle'
              }`}
            >
              {p.name} · {p.days} days
            </li>
          )
        })}
      </ol>
    </div>
  )
}
