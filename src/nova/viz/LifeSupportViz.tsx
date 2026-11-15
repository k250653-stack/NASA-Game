import { useState } from 'react'
import { fmt, num, VizFrame, type VizProps } from './VizFrame'

const TANKS = [
  { key: 'oxygen', label: 'O₂', rate: 'oxygenKgPerDay', fill: 'fill-accent', recycles: true },
  { key: 'water', label: 'H₂O', rate: 'waterKgPerDay', fill: 'fill-role-comms', recycles: true },
  { key: 'food', label: 'Food', rate: 'foodKgPerDay', fill: 'fill-alert', recycles: false },
] as const

/** Three tanks: what the crew needs for the whole mission, shrinking as recycling improves. */
export function LifeSupportViz({ params, live }: VizProps) {
  const crew = live.crew || num(params, 'crew', 4)
  const days = live.days || num(params, 'days', 30)
  const [recycle, setRecycle] = useState(Math.round((live.waterRecycle ?? 0) * 100))
  const need = TANKS.map((t) => {
    const raw = crew * days * num(params, t.rate, 1)
    return { ...t, raw, kg: t.recycles ? raw * (1 - recycle / 100) : raw }
  })
  const max = Math.max(...need.map((t) => t.raw))
  const total = need.reduce((a, t) => a + t.kg, 0)
  return (
    <VizFrame
      slider={{
        label: 'Recycling',
        min: 0,
        max: 98,
        step: 1,
        value: recycle,
        onChange: setRecycle,
        format: (v) => `${v}%`,
      }}
      caption={`${crew} crew × ${days} days: launch about ${fmt(total)} kg of supplies.`}
    >
      <svg
        viewBox="0 0 400 120"
        className="w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Life support supplies"
      >
        {need.map((t, i) => {
          const h = (t.kg / max) * 80
          const x = 40 + i * 120
          return (
            <g key={t.key}>
              <rect
                x={x}
                y="10"
                width="60"
                height="84"
                className="fill-bg stroke-border-strong"
                strokeWidth="2"
              />
              <rect x={x + 2} y={92 - h} width="56" height={h} className={t.fill} />
              <text
                x={x + 30}
                y="110"
                textAnchor="middle"
                className="fill-muted font-mono text-[11px]"
              >
                {t.label} {fmt(t.kg)} kg
              </text>
            </g>
          )
        })}
      </svg>
    </VizFrame>
  )
}
