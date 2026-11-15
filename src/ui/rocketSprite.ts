import type { Rocket } from '@/schemas'

export type RocketSize = 'light' | 'medium' | 'heavy'

/** Size class of a rocket from its id (super heavy uses heavy). */
export function rocketSize(rocket: Pick<Rocket, 'id'>): RocketSize {
  return (['light', 'medium', 'heavy'] as const).find((s) => rocket.id.startsWith(s)) ?? 'heavy'
}

/** "rocket-light" / "rocket-medium" / "rocket-heavy" sprite id (super heavy uses heavy). */
export function rocketSprite(rocket: Pick<Rocket, 'id'>): string {
  return `rocket-${rocketSize(rocket)}`
}

/**
 * Pixel calibration for the standing sprites (rocket-<size>.png) and the engines-on art
 * (rocket-<size>-flameon.png), measured from the files. The flame art is drawn at a higher
 * resolution: `ratio` flame pixels per standing-sprite pixel, so both show the same rocket size.
 * cx = centre line of the body; baseY = where the nozzles end (the pad line).
 */
export const ROCKET_ART: Record<
  RocketSize,
  {
    w: number
    h: number
    cx: number
    flame: { w: number; h: number; cx: number; baseY: number; ratio: number }
  }
> = {
  light: { w: 36, h: 192, cx: 17.5, flame: { w: 288, h: 866, cx: 143.5, baseY: 470, ratio: 2.45 } },
  medium: { w: 44, h: 192, cx: 21.5, flame: { w: 288, h: 866, cx: 144, baseY: 468, ratio: 2.44 } },
  heavy: { w: 96, h: 192, cx: 47.5, flame: { w: 353, h: 707, cx: 176.5, baseY: 440, ratio: 2.29 } },
}
