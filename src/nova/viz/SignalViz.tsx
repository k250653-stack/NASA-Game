import { useState } from 'react'
import { fmt, num, VizFrame, type VizProps } from './VizFrame'

const W = 400
const H = 100

/**
 * Data rate × contact time vs data collected. With params.delaySlider: the one-way light delay,
 * shown as a message dot travelling from Earth to the planet.
 */
export function SignalViz({ params, live }: VizProps) {
  const collected = live.dataGbPerDay ?? num(params, 'dataGbPerDay', 10)
  const contact0 = live.contactHours ?? num(params, 'contactHours', 8)
  const perHour =
    (live.returnGbPerDay ?? num(params, 'rateMbps', 20) * 0.45 * contact0) / Math.max(1, contact0)
  const delayMode = params.delaySlider === true
  const [value, setValue] = useState(
    delayMode ? Math.round(live.delayMin || num(params, 'delayMin', 12)) : Math.round(contact0),
  )

  const sent = Math.min(collected, perHour * value)
  const share = collected > 0 ? sent / collected : 1
  const maxDelay = 22
  return (
    <VizFrame
      slider={
        delayMode
          ? {
              label: 'One-way delay',
              min: 1,
              max: maxDelay,
              step: 1,
              value,
              onChange: setValue,
              format: (v) => `${v} min`,
            }
          : {
              label: 'Contact hours',
              min: 0,
              max: 24,
              step: 1,
              value,
              onChange: setValue,
              format: (v) => `${v} h/day`,
            }
      }
      caption={
        delayMode
          ? `Question and answer take ${value * 2} min. An urgent alarm cannot wait that long.`
          : `Sent ${fmt(sent, 1)} of ${fmt(collected, 1)} GB/day: ${Math.round(share * 100)}% reaches Earth.`
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Signal between Earth and the base"
      >
        <circle cx="30" cy="50" r="18" className="fill-accent/30 stroke-accent" />
        <rect x={W - 48} y="32" width="36" height="36" className="fill-danger/30 stroke-danger" />
        <line
          x1="50"
          x2={W - 50}
          y1="50"
          y2="50"
          className="stroke-border-strong"
          strokeDasharray="4 4"
        />
        {delayMode ? (
          <rect
            x={50 + ((W - 104) * value) / maxDelay}
            y="46"
            width="8"
            height="8"
            className="fill-alert"
          />
        ) : (
          <>
            <rect
              x="60"
              y="74"
              width={W - 120}
              height="12"
              className="fill-bg stroke-border-strong"
            />
            <rect
              x="60"
              y="74"
              width={(W - 120) * share}
              height="12"
              className={share >= 0.95 ? 'fill-success' : 'fill-alert'}
            />
            {Array.from({ length: Math.min(12, Math.round(share * 12)) }, (_, i) => (
              <rect key={i} x={70 + i * 22} y="46" width="6" height="6" className="fill-accent" />
            ))}
          </>
        )}
      </svg>
    </VizFrame>
  )
}
