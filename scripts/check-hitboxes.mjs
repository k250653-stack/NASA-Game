// One-off hitbox sanity check for src/world/rooms/hq-map.json (not part of the test setup).
// Usage: node scripts/check-hitboxes.mjs
// Flood-fills a 4 px grid from spawn over (floors ∪ doorways ∪ outdoor) minus blocked, then
// reports reachability of every room floor and station, blockers that sit outside every floor,
// self-intersecting polygons, and the fixed points (spawn, table spots, ...) that are off the floor.
import { readFileSync } from 'node:fs'

const map = JSON.parse(readFileSync(new URL('../src/world/rooms/hq-map.json', import.meta.url), 'utf8'))
const STEP = 4
const [W, H] = map.size

function inside([x, y], poly) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
function distToPoly(p, poly) {
  if (inside(p, poly)) return 0
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]
    const [bx, by] = poly[i]
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)))
  }
  return best
}
function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}
function selfIntersects(poly) {
  const n = poly.length
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue
      if (segsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true
    }
  return false
}

const floors = map.rooms.map((r) => r.floor)
const walk = [...floors, ...map.doorways.map((d) => d.area), ...map.outdoor]
const free = (p) => walk.some((w) => inside(p, w)) && !map.blocked.some((b) => inside(p, b))

// Flood fill from spawn on a 4 px grid.
const cols = Math.ceil(W / STEP)
const rows = Math.ceil(H / STEP)
const seen = new Uint8Array(cols * rows)
const reach = []
const start = [Math.round(map.spawn[0] / STEP), Math.round(map.spawn[1] / STEP)]
const lines = []
if (!free([start[0] * STEP, start[1] * STEP])) lines.push('FAIL spawn is not on walkable ground')
const stack = [start]
while (stack.length) {
  const [cx, cy] = stack.pop()
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue
  const k = cy * cols + cx
  if (seen[k]) continue
  seen[k] = 1
  const p = [cx * STEP, cy * STEP]
  if (!free(p)) continue
  reach.push(p)
  stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
}

for (const r of map.rooms) {
  const cells = reach.filter((p) => inside(p, r.floor)).length
  const total = (() => {
    let n = 0
    for (let y = 0; y < H; y += STEP)
      for (let x = 0; x < W; x += STEP) if (inside([x, y], r.floor) && free([x, y])) n++
    return n
  })()
  lines.push(`${cells > 0 ? 'ok  ' : 'FAIL'} room ${r.id}: ${cells}/${total} free cells reachable`)
}
for (const s of map.stations) {
  const best = Math.min(...reach.map((p) => distToPoly(p, s.area)))
  lines.push(`${best <= s.reach ? 'ok  ' : 'FAIL'} station ${s.id}: nearest reachable point ${best.toFixed(1)} px (reach ${s.reach})`)
}
map.blocked.forEach((b, i) => {
  const onFloor = b.some((p) => floors.some((f) => inside(p, f)))
  if (!onFloor) lines.push(`WARN blocker #${i} ${JSON.stringify(b[0])} sits outside every floor`)
})
const polys = [
  ...map.rooms.map((r) => [`floor ${r.id}`, r.floor]),
  ...map.doorways.map((d) => [`doorway ${d.id}`, d.area]),
  ...map.blocked.map((b, i) => [`blocker #${i}`, b]),
  ...map.occluders.map((o) => [`occluder ${o.id}`, o.area]),
  ...map.stations.map((s) => [`station ${s.id}`, s.area]),
  ...map.outdoor.map((o, i) => [`outdoor #${i}`, o]),
]
for (const [name, poly] of polys) if (selfIntersects(poly)) lines.push(`FAIL ${name} has self-intersecting edges`)
const points = { spawn: map.spawn, tableCenter: map.tableCenter, briefingArrival: map.briefingArrival }
map.tableSpots.forEach((p, i) => (points[`tableSpot${i}`] = p))
for (const [name, p] of Object.entries(points))
  if (!walk.some((w) => inside(p, w))) lines.push(`WARN ${name} ${JSON.stringify(p)} is off the walkable area`)

console.log(lines.join('\n'))
console.log(lines.some((l) => l.startsWith('FAIL')) ? '\nRESULT: problems found' : '\nRESULT: all checks passed')
