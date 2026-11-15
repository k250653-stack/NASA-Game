import type { ReactNode } from 'react'
import type { VizLive } from '../applyValues'

/** What every NOVA visual receives: the lesson's vizParams and the player's live numbers. */
export interface VizProps {
  params: Record<string, number | string | boolean>
  live: VizLive
}

/** A number from the lesson params, else the fallback. */
export function num(params: VizProps['params'], key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' ? v : fallback
}

interface SliderProps {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format: (v: number) => string
}

/** A pixel panel with an SVG drawing above and one labelled slider below. */
export function VizFrame({
  children,
  slider,
  caption,
}: {
  children: ReactNode
  slider: SliderProps
  caption: ReactNode
}) {
  return (
    <figure className="border border-border-strong bg-surface p-3" data-testid="nova-viz">
      <div className="[image-rendering:pixelated]">{children}</div>
      <label className="mt-2 flex items-center gap-3 font-mono text-xs text-muted">
        <span className="w-32 font-title text-sm tracking-wide uppercase">{slider.label}</span>
        <input
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={slider.value}
          onChange={(e) => slider.onChange(Number(e.target.value))}
          className="flex-1 accent-accent"
          data-testid="nova-viz-slider"
        />
        <span className="w-24 text-right text-primary tabular-nums">
          {slider.format(slider.value)}
        </span>
      </label>
      <figcaption className="mt-1 font-mono text-xs text-primary tabular-nums">
        {caption}
      </figcaption>
    </figure>
  )
}

export const fmt = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { maximumFractionDigits: digits })
