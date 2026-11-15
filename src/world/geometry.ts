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

/** Smallest convex polygon around the points (monotone chain), counter-clockwise. */
export function convexHull(points: readonly Point[]): Polygon {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Point[]) => {
    const out: Point[] = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...half(pts), ...half([...pts].reverse())]
}

export function translate(poly: Polygon, [dx, dy]: Point): Polygon {
  return poly.map(([x, y]) => [x + dx, y + dy] as const)
}
