import { getAsset } from './assets'

interface HelmetPortraitProps {
  /** Box size in px (the crop is shown 1:1, so keep it near 56). */
  size?: number
  className?: string
}

/** Sheet is 30 frames of 258 px; frame 0 faces the camera. */
const SHEET_W = 7740
const SHEET_H = 258
/** Top-left of the helmet-and-shoulders crop inside frame 0. */
const CROP = { x: 98, y: 66 }

/**
 * Generic astronaut portrait for the player: the front-facing idle sprite cropped to the helmet,
 * drawn with crisp pixels. Used where a teammate would have a portrait.
 */
export function HelmetPortrait({ size = 56, className = '' }: HelmetPortraitProps) {
  return (
    <div
      role="img"
      aria-label="Your astronaut"
      className={`shrink-0 bg-surface [image-rendering:pixelated] ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${getAsset('sprites', 'maincharacter/IDLE', 'png')})`,
        backgroundSize: `${SHEET_W}px ${SHEET_H}px`,
        backgroundPosition: `-${CROP.x}px -${CROP.y}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  )
}
