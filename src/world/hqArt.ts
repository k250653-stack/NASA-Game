/** Phaser drawing for the HQ: padlocks and room dimming. */
import Phaser from 'phaser'
import type { Point } from './geometry'

/** Theme colour token (index.css) as a Phaser colour number. */
export function tokenColor(name: string): number {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  return hex.startsWith('#')
    ? Phaser.Display.Color.HexStringToColor(hex.slice(0, 7)).color
    : 0xffffff
}

/** Theme colour token (index.css) as a CSS colour string, for Phaser text. */
export function tokenCss(name: string): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim() || 'white'
  )
}

/** Small padlock drawn with shapes (no image asset needed). */
export function drawPadlock(scene: Phaser.Scene, [x, y]: Point): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(4)
  const body = tokenColor('muted')
  const dark = tokenColor('bg')
  g.lineStyle(5, body, 1)
  g.beginPath()
  g.arc(x, y - 14, 11, Math.PI, 0)
  g.strokePath()
  g.fillStyle(body, 1).fillRoundedRect(x - 18, y - 14, 36, 30, 4)
  g.fillStyle(dark, 1)
    .fillCircle(x, y - 2, 4)
    .fillRect(x - 1.5, y, 3, 9)
  return g
}

/** Locked rooms: ~25% brightness and slightly desaturated. 0 = locked look, 1 = normal. */
export interface RoomLight {
  set: (lit: number) => void
}

export function roomLight(image: Phaser.GameObjects.Image): RoomLight {
  // Colour-matrix FX only exists in WebGL; tint alone still darkens on Canvas.
  const matrix = image.preFX?.addColorMatrix()
  return {
    set: (lit) => {
      const v = Math.round(255 * (0.25 + 0.75 * lit))
      image.setTint(Phaser.Display.Color.GetColor(v, v, v))
      matrix?.saturate(-0.4 * (1 - lit))
    },
  }
}

/** Tiny scale-pop of a station outline when it is used (scaled about its own centre). */
export function popOutline(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics | null,
  [cx, cy]: Point,
): void {
  if (!g) return
  const state = { s: 1.08 }
  scene.tweens.add({
    targets: state,
    s: 1,
    duration: 140,
    ease: 'Back.Out',
    onUpdate: () => g.setScale(state.s).setPosition(cx * (1 - state.s), cy * (1 - state.s)),
  })
}
