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
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)))
  }
  return best
}

/** Average of the corners (good enough for convex-ish shapes). */
export function centroid(poly: Polygon): Point {
  const sum = poly.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
  return [sum[0] / poly.length, sum[1] / poly.length]
}

/** Inside the walkable polygon and outside every blocked one. */
export function canStand(p: Point, walkable: Polygon, blocked: readonly Polygon[]): boolean {
  return pointInPolygon(p, walkable) && !blocked.some((b) => pointInPolygon(p, b))
}

/**
 * The first standable point on the line from `from` towards `to` (in 2% steps), or `to`.
 * Used to put the player just in front of a door, on the floor.
 */
export function nearestStandable(
  from: Point,
  to: Point,
  walkable: Polygon,
  blocked: readonly Polygon[],
): Point {
  for (let t = 0; t <= 1; t += 0.02) {
    const p: Point = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
    if (canStand(p, walkable, blocked)) return p
  }
  return to
}
