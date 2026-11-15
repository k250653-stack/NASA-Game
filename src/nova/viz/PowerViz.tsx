import { useState } from 'react'
import { fmt, num, VizFrame, type VizProps } from './VizFrame'

const W = 400
const H = 110

/**
 * Sunlight vs dark and the battery. Default slider: hours into the night (battery drains at the
 * base load). With params.dustSlider: dust on the panels cuts solar output.
 */
export function PowerViz({ params, live }: VizProps) {
  const load = live.loadW ?? num(params, 'loadW', 2000)
  const solar = live.solarW ?? num(params, 'solarW', 6000)
  const battery = live.batteryWh || num(params, 'batteryWh', 30000)
  const dark = live.darkHours || num(params, 'darkHours', 14)
  const dustMode = params.dustSlider === true
  const [value, setValue] = useState(dustMode ? 30 : Math.round(dark / 2))

  const dust = dustMode ? value / 100 : 0
  const solarNow = solar * (1 - dust)
  const hours = dustMode ? 0 : value
  const left = Math.max(0, battery - load * hours)
  const share = battery > 0 ? left / battery : 0
  const sunShare = Math.min(1, solarNow / Math.max(load * 2, solar))
  return (
    <VizFrame
      slider={
        dustMode
          ? {
              label: 'Dust on panels',
              min: 0,
              max: 80,
              step: 5,
              value,
              onChange: setValue,
              format: (v) => `${v}%`,
            }
          : {
              label: 'Hours of dark',
              min: 0,
              max: Math.ceil(dark),
              step: 1,
              value,
              onChange: setValue,
              format: (v) => `${v} h`,
            }
      }
      caption={
        dustMode
          ? `Solar ${fmt(solarNow)} W vs load ${fmt(load)} W: ${solarNow >= load ? 'enough' : 'short'} in daylight.`
          : left > 0
            ? `Battery ${Math.round(share * 100)}% after ${hours} h (${fmt(left)} Wh left).`
            : `Battery empty after ${fmt(battery / Math.max(1, load), 1)} h: life support stops.`
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Solar power and battery"
      >
        {/* Sun or night sky */}
        <rect
          x="0"
          y="0"
          width={W / 2}
          height={H}
          className={dustMode || hours === 0 ? 'fill-alert/15' : 'fill-bg'}
        />
        <circle
          cx="40"
          cy="30"
          r="14"
          className={dustMode || hours === 0 ? 'fill-alert' : 'fill-border-strong'}
        />
        {/* Solar panel with dust specks */}
        <rect x="70" y="60" width="110" height="24" className="fill-accent/40 stroke-accent" />
        {Array.from({ length: Math.round(dust * 30) }, (_, i) => (
          <rect
            key={i}
            x={72 + ((i * 37) % 104)}
            y={62 + ((i * 13) % 20)}
            width="3"
            height="3"
            className="fill-muted"
          />
        ))}
        <rect x="70" y="92" width={110 * sunShare} height="6" className="fill-alert" />
        {/* Battery */}
        <rect
          x="260"
          y="20"
          width="90"
          height="70"
          className="fill-bg stroke-border-strong"
          strokeWidth="2"
        />
        <rect x="295" y="12" width="20" height="8" className="fill-border-strong" />
        <rect
          x="264"
          y={24 + 62 * (1 - share)}
          width="82"
          height={62 * share}
          className={share > 0.3 ? 'fill-success' : share > 0 ? 'fill-alert' : 'fill-danger'}
        />
        <text x="305" y="104" textAnchor="middle" className="fill-muted font-mono text-[11px]">
          {fmt(battery)} Wh
        </text>
      </svg>
    </VizFrame>
  )
}
