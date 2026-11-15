import { useState } from 'react'
import { fmt, num, VizFrame, type VizProps } from './VizFrame'

const CX = 80
const CY = 70

/** A burn in low orbit stretches the far side of the orbit; drag the burn and watch it reach out. */
export function OrbitViz({ params }: VizProps) {
  const target = num(params, 'targetDistanceKm', 384400)
  const [burn, setBurn] = useState(70)
  // Teaching sketch, not physics: the far point grows with the burn and passes the target near 100%.
  const apo = 20 + (burn / 100) * 300
  const reach = Math.round((burn / 100) * target)
  const a = (apo + 20) / 2
  const b = Math.max(14, a * 0.35)
  return (
    <VizFrame
      slider={{
        label: 'Burn size',
        min: 10,
        max: 100,
        step: 5,
        value: burn,
        onChange: setBurn,
        format: (v) => `${v}%`,
      }}
      caption={
        reach >= target
          ? `The orbit now reaches ${fmt(target)} km: coast there.`
          : `Far side reaches about ${fmt(reach)} km.`
      }
    >
      <svg
        viewBox="0 0 400 140"
        className="w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Transfer orbit"
      >
        <ellipse
          cx={CX - 20 + a}
          cy={CY}
          rx={a}
          ry={b}
          className="fill-none stroke-accent"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <circle cx={CX} cy={CY} r="16" className="fill-accent/30 stroke-accent" />
        <circle cx="380" cy={CY} r="8" className="fill-muted" />
        <rect x={CX - 20} y={CY - 3} width="6" height="6" className="fill-alert" />
      </svg>
    </VizFrame>
  )
}
