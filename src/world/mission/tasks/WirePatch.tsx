import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { createRng } from '@/engine/rng'
import { playSound } from '@/ui/sound'
import type { TaskProps } from './types'

const W = 480
const H = 240
const LEFT_X = 50
const RIGHT_X = 430
const ROWS = [45, 95, 145, 195]
/** How close (svg px) the wire end must be to a socket to plug in. */
const SNAP = 26
const WIRES = [
  { id: 'amber', stroke: 'stroke-alert', fill: 'fill-alert' },
  { id: 'cyan', stroke: 'stroke-accent', fill: 'fill-accent' },
  { id: 'green', stroke: 'stroke-success', fill: 'fill-success' },
  { id: 'red', stroke: 'stroke-danger', fill: 'fill-danger' },
] as const

/** Drag each wire (or click it, then a socket) to the socket of the same colour. */
export function WirePatch({ seed, onComplete }: TaskProps) {
  // Sockets on the right, shuffled with the seeded rng (Fisher-Yates).
  const sockets = useMemo(() => {
    const rng = createRng(seed)
    const order = [0, 1, 2, 3]
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(0, i)
      ;[order[i], order[j]] = [order[j]!, order[i]!]
    }
    return order
  }, [seed])
  const [done, setDone] = useState<boolean[]>([false, false, false, false])
  const [held, setHeld] = useState<number | null>(null)
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  const toSvg = (e: PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
  }
  const plug = (wire: number, socketRow: number) => {
    if (sockets[socketRow] !== wire || done[wire]) return false
    const next = done.map((d, i) => d || i === wire)
    setDone(next)
    playSound('wire-click')
    if (next.every(Boolean)) onComplete()
    return true
  }
  const release = (e: PointerEvent) => {
    if (held === null) return
    const [x, y] = toSvg(e)
    const row = ROWS.findIndex((ry) => Math.hypot(x - RIGHT_X, y - ry) < SNAP)
    if (row >= 0 && plug(held, row)) setHeld(null)
    else if (row >= 0) playSound('fail')
    setCursor(null)
  }

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      shapeRendering="crispEdges"
      onPointerMove={(e) => held !== null && setCursor(toSvg(e))}
      onPointerUp={release}
      role="img"
      aria-label="Wire patch: connect each wire to its matching socket"
      data-testid="task-wire-patch"
    >
      <rect x="0" y="0" width={W} height={H} className="fill-bg" />
      {WIRES.map((w, i) => {
        const row = sockets.indexOf(i)
        const [ex, ey] = done[i]
          ? [RIGHT_X, ROWS[row]!]
          : held === i && cursor
            ? cursor
            : [LEFT_X + 20, ROWS[i]!]
        return (
          <g key={w.id}>
            <polyline
              points={`${LEFT_X},${ROWS[i]} ${(LEFT_X + ex) / 2},${ROWS[i]} ${(LEFT_X + ex) / 2},${ey} ${ex},${ey}`}
              fill="none"
              className={w.stroke}
              strokeWidth="6"
            />
            <rect
              x={LEFT_X - 14}
              y={ROWS[i]! - 10}
              width="20"
              height="20"
              className={`${w.fill} cursor-grab`}
              onPointerDown={(e) => {
                if (done[i]) return
                ;(e.target as Element).setPointerCapture?.(e.pointerId)
                setHeld(i)
                setCursor(toSvg(e))
              }}
            />
          </g>
        )
      })}
      {sockets.map((wire, row) => (
        <g key={row}>
          <rect
            x={RIGHT_X - 4}
            y={ROWS[row]! - 12}
            width="28"
            height="24"
            className="fill-surface stroke-border-strong"
            strokeWidth="2"
          />
          <rect
            x={RIGHT_X + 4}
            y={ROWS[row]! - 6}
            width="12"
            height="12"
            className={WIRES[wire]!.fill}
          />
        </g>
      ))}
    </svg>
  )
}
