import { useEffect, useRef } from 'react'
import { createRng } from '@/engine/rng'
import { playSound } from '@/ui/sound'
import type { TaskProps } from './types'

/** Dust grid: 80 x 45 cells of 6 px = a 480 x 270 canvas shown at 1x (crisp pixels). */
const COLS = 80
const ROWS = 45
const CELL = 6
/** Brush radius in cells, and the share that must be clean. */
const BRUSH = 3
const GOAL = 0.9
/** Hiss at most this often while scrubbing, ms. */
const HISS_MS = 160

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}

/** Hold the mouse and scrub the dust off the solar panel until it is 90 % clean. */
export function PanelClean({ seed, onComplete }: TaskProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const dust = useRef<Uint8Array>(new Uint8Array(COLS * ROWS).fill(1))
  const left = useRef(COLS * ROWS)
  const down = useRef(false)
  const done = useRef(false)
  const lastHiss = useRef(0)

  // Panel cells underneath, then a speckled dust layer (shades from the seeded rng).
  const draw = () => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const rng = createRng(seed)
    const [panel, line, dustA, dustB] = [
      cssVar('accent'),
      cssVar('bg'),
      cssVar('alert'),
      cssVar('muted'),
    ]
    ctx.fillStyle = line
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL)
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x
        const cellEdge = x % 10 === 0 || y % 9 === 0
        const shade = rng.next() // drawn for every cell, so the dust pattern never shifts
        ctx.fillStyle = dust.current[i] ? (shade < 0.5 ? dustA : dustB) : cellEdge ? line : panel
        ctx.globalAlpha = dust.current[i] ? 0.85 : cellEdge ? 1 : 0.55
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    ctx.globalAlpha = 1
  }
  useEffect(draw)

  const scrub = (clientX: number, clientY: number) => {
    if (!down.current || done.current || !canvas.current) return
    const r = canvas.current.getBoundingClientRect()
    const cx = Math.floor(((clientX - r.left) / r.width) * COLS)
    const cy = Math.floor(((clientY - r.top) / r.height) * ROWS)
    let changed = false
    for (let y = cy - BRUSH; y <= cy + BRUSH; y++)
      for (let x = cx - BRUSH; x <= cx + BRUSH; x++) {
        if (
          x < 0 ||
          y < 0 ||
          x >= COLS ||
          y >= ROWS ||
          (x - cx) ** 2 + (y - cy) ** 2 > BRUSH * BRUSH
        )
          continue
        const i = y * COLS + x
        if (dust.current[i]) {
          dust.current[i] = 0
          left.current--
          changed = true
        }
      }
    if (!changed) return
    const now = performance.now()
    if (now - lastHiss.current > HISS_MS) {
      lastHiss.current = now
      playSound('scrub')
    }
    draw()
    if (1 - left.current / (COLS * ROWS) >= GOAL) {
      done.current = true
      onComplete()
    }
  }

  return (
    <div className="flex flex-col items-center gap-2" data-testid="task-panel-clean">
      <canvas
        ref={canvas}
        width={COLS * CELL}
        height={ROWS * CELL}
        className="h-[270px] w-[480px] max-w-full cursor-crosshair touch-none border-2 border-border-strong [image-rendering:pixelated]"
        onPointerDown={(e) => {
          down.current = true
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          scrub(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => scrub(e.clientX, e.clientY)}
        onPointerUp={() => (down.current = false)}
        aria-label="Dusty solar panel: hold the mouse and scrub"
      />
    </div>
  )
}
