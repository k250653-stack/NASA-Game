import { AssetImage } from './AssetImage'
import { ROCKET_ART, type RocketSize } from './rocketSprite'

interface RocketArtProps {
  size: RocketSize
  /** Screen pixels per standing-sprite pixel (whole number keeps it crisp). */
  scale: number
  /** Engines on: swap to the rocket-<size>-flameon art, flame hanging below the base. */
  flame?: boolean
  className?: string
}

/**
 * A rocket whose box is the standing sprite (so layout and the pad line never move). With
 * `flame`, the engines-on art replaces it, scaled so the rocket body stays the same size and
 * aligned on the same centre line and nozzle line; the flame overflows below the box.
 */
export function RocketArt({ size, scale, flame = false, className = '' }: RocketArtProps) {
  const art = ROCKET_ART[size]
  const w = art.w * scale
  const h = art.h * scale
  const f = art.flame
  const fs = scale / f.ratio
  return (
    <div className={`relative ${className}`} style={{ width: w, height: h }}>
      {flame ? (
        <AssetImage
          kind="sprites"
          id={`rocket-${size}-flameon`}
          ext="png"
          alt=""
          className="absolute max-w-none [image-rendering:pixelated]"
          style={{
            width: f.w * fs,
            height: f.h * fs,
            left: art.cx * scale - f.cx * fs,
            top: h - f.baseY * fs,
          }}
        />
      ) : (
        <AssetImage
          kind="sprites"
          id={`rocket-${size}`}
          ext="png"
          alt=""
          className="size-full [image-rendering:pixelated]"
        />
      )}
    </div>
  )
}
