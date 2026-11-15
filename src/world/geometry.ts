/** Polygon helpers for room walk areas. Pure, no Phaser. */

export type Point = readonly [number, number]
export type Polygon = readonly Point[]

/** Ray-casting test; points exactly on an edge may go either way. */
export function pointInPolygon([x, y]: Point, poly: Polygon): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** 0 inside the polygon, otherwise the distance to its nearest edge. */
export function distanceToPolygon(p: Point, poly: Polygon): number {
  if (pointInPolygon(p, poly)) return 0
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]!
    const [bx, by] = poly[i]!
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(
      0,
      Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)),
    )
    best = Math.min(best, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)))
  }
  return best
}

/** Average of the corners (good enough for convex-ish shapes). */
export function centroid(poly: Polygon): Point {
  const sum = poly.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
  return [sum[0] / poly.length, sum[1] / poly.length]
}

/** Inside any walkable polygon and outside every blocked one. */
export function canStand(
  p: Point,
  walkable: readonly Polygon[],
  blocked: readonly Polygon[],
): boolean {
  return walkable.some((w) => pointInPolygon(p, w)) && !blocked.some((b) => pointInPolygon(p, b))
}

/** The player's collision shape: a small ellipse at the feet (half-width, half-height in px). */
export const FOOT_RX = 7
export const FOOT_RY = 3.5

/**
 * The foot ellipse fits: its centre and its four extreme points are each on some walkable
 * polygon and none is inside a blocker. Only the feet collide, never the drawn body.
 */
export function canStandFeet(
  [x, y]: Point,
  walkable: readonly Polygon[],
  blocked: readonly Polygon[],
): boolean {
  const pts: Point[] = [
    [x, y],
    [x - FOOT_RX, y],
    [x + FOOT_RX, y],
    [x, y - FOOT_RY],
    [x, y + FOOT_RY],
  ]
  return pts.every((p) => canStand(p, walkable, blocked))
}

export function translate(poly: Polygon, [dx, dy]: Point): Polygon {
  return poly.map(([x, y]) => [x + dx, y + dy] as const)
}
