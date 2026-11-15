import { useState } from 'react'
import { fmt, num, VizFrame, type VizProps } from './VizFrame'

const W = 400
const BAR_Y = 30
const BAR_H = 26

/** Rocket capacity bar: drag the payload mass and watch the margin go from green to red. */
export function MassViz({ params, live }: VizProps) {
  const capacity = live.capacityKg ?? num(params, 'capacityKg', 8000)
  const compare = num(params, 'compareCapacityKg', 0)
  const max = Math.max(num(params, 'maxMassKg', capacity * 1.4), capacity * 1.2, compare * 1.05)
  const [mass, setMass] = useState(() =>
    Math.round(live.massKg ?? num(params, 'startMassKg', capacity * 0.8)),
  )
  const x = (kg: number) => (kg / max) * W
  const margin = (capacity - mass) / capacity
  const fill = margin < 0 ? 'fill-danger' : margin < 0.1 ? 'fill-alert' : 'fill-success'
  return (
    <VizFrame
      slider={{
        label: 'Payload mass',
        min: 0,
        max: Math.round(max),
        step: 50,
        value: mass,
        onChange: setMass,
        format: (v) => `${fmt(v)} kg`,
      }}
      caption={
        margin < 0
          ? `Over by ${fmt(-margin * capacity)} kg: it does not fit.`
          : `Margin ${Math.round(margin * 100)}% (${fmt(capacity - mass)} kg spare).`
      }
    >
      <svg
        viewBox={`0 0 ${W} 90`}
        className="w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Payload mass against rocket capacity"
      >
        <rect x="0" y={BAR_Y} width={W} height={BAR_H} className="fill-bg stroke-border-strong" />
        <rect x="0" y={BAR_Y} width={Math.min(W, x(mass))} height={BAR_H} className={fill} />
        <line
          x1={x(capacity)}
          x2={x(capacity)}
          y1={BAR_Y - 10}
          y2={BAR_Y + BAR_H + 10}
          className="stroke-accent"
          strokeWidth="2"
        />
        <text
          x={x(capacity)}
          y={BAR_Y - 14}
          textAnchor="middle"
          className="fill-accent font-mono text-[11px]"
        >
          capacity {fmt(capacity)} kg
        </text>
        {compare > 0 && (
          <>
            <line
              x1={x(compare)}
              x2={x(compare)}
              y1={BAR_Y - 4}
              y2={BAR_Y + BAR_H + 4}
              className="stroke-alert"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <text
              x={Math.min(W - 60, x(compare))}
              y={BAR_Y + BAR_H + 22}
              textAnchor="middle"
              className="fill-alert font-mono text-[11px]"
            >
              heavy rocket {fmt(compare)} kg
            </text>
          </>
        )}
      </svg>
    </VizFrame>
  )
}
