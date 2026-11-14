/** Phaser drawing for the connected HQ: corridors, padlocks, and room dimming. */
import Phaser from 'phaser'
import type { Point, Polygon } from './geometry'
import type { Corridor } from './hqMap'

/** Theme colour token (index.css) as a Phaser colour number. */
export function tokenColor(name: string): number {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  return hex.startsWith('#') ? Phaser.Display.Color.HexStringToColor(hex.slice(0, 7)).color : 0xffffff
}

const vec = (poly: Polygon) => poly.map(([x, y]) => new Phaser.Math.Vector2(x, y))

/** Spacing of the floor lights along each railing, in world pixels. */
const LIGHT_SPACING = 34

export interface CorridorArt {
  /** Floor lights ordered from the lobby door to the room. */
  lights: Phaser.GameObjects.Arc[]
  color: number
  offColor: number
}

/** Dark metal walkway with thin railings and floor lights along both edges. */
export function drawCorridor(scene: Phaser.Scene, c: Corridor, width: number): CorridorArt {
  const g = scene.add.graphics().setDepth(0)
  const metal = tokenColor('panel-raised')
  const seam = tokenColor('border')
  const rail = tokenColor('border-strong')
  for (const poly of c.polys) g.fillStyle(metal, 1).fillPoints(vec(poly), true)

  const h = width / 2
  const lights: Phaser.GameObjects.Arc[] = []
  const color = tokenColor(c.door.color)
  const offColor = tokenColor('border')
  for (let i = 1; i < c.path.length; i++) {
    const [ax, ay] = c.path[i - 1]!
    const [bx, by] = c.path[i]!
    const len = Math.hypot(bx - ax, by - ay) || 1
    const ux = (bx - ax) / len
    const uy = (by - ay) / len
    const nx = -uy
    const ny = ux
    // Floor plate seams across the walkway.
    g.lineStyle(1, seam, 0.8)
    for (let d = 16; d < len; d += 32) {
      const cx = ax + ux * d
      const cy = ay + uy * d
      g.lineBetween(cx + nx * h, cy + ny * h, cx - nx * h, cy - ny * h)
    }
    // Railings just inside each edge.
    g.lineStyle(2, rail, 1)
    for (const side of [1, -1]) {
      const o = (h - 3) * side
      g.lineBetween(ax + nx * o, ay + ny * o, bx + nx * o, by + ny * o)
    }
    for (let d = LIGHT_SPACING / 2; d < len; d += LIGHT_SPACING) {
      for (const side of [1, -1]) {
        const o = (h - 9) * side
        const p: Point = [ax + ux * d + nx * o, ay + uy * d + ny * o]
        lights.push(scene.add.circle(p[0], p[1], 2.5, color).setDepth(0.5))
      }
    }
  }
  return { lights, color, offColor }
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
  g.fillStyle(dark, 1).fillCircle(x, y - 2, 4).fillRect(x - 1.5, y, 3, 9)
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
