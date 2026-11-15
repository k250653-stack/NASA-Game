import { useEffect, useMemo, useRef, useState } from 'react'
import { createRng } from '@/engine/rng'
import { SegmentBar } from '@/ui/SegmentBar'
import { playSound } from '@/ui/sound'
import type { TaskProps } from './types'

/** Signal at or above this share counts as "in the green", held for HOLD_MS to finish. */
const GREEN = 0.8
const HOLD_MS = 2000
/** Degrees per arrow press, per dragged pixel, and the signal's fall-off in degrees. */
const STEP_DEG = 3
const DRAG_DEG = 0.5
const FALLOFF_DEG = 50
const BEEP_MS = 450

/** Turn the dish (arrow keys or drag) and hold the signal in the green zone for 2 seconds. */
export function DishAlign({ seed, onComplete }: TaskProps) {
  const { target, start } = useMemo(() => {
    const rng = createRng(seed)
    const t = rng.int(40, 140)
    return { target: t, start: t > 90 ? rng.int(10, 35) : rng.int(145, 170) }
  }, [seed])
  const [angle, setAngle] = useState(start)
  const [held, setHeld] = useState(0)
  const angleRef = useRef(angle)
  useEffect(() => {
    angleRef.current = angle
  }, [angle])
  // The loop below runs once; it reads the latest callback from a ref.
  const finish = useRef(onComplete)
  useEffect(() => {
    finish.current = onComplete
  }, [onComplete])
  const drag = useRef<number | null>(null)
  const done = useRef(false)
  const signal = Math.max(0, 1 - Math.abs(angle - target) / FALLOFF_DEG)

  const turn = (deg: number) => setAngle((a) => Math.max(0, Math.min(180, a + deg)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') turn(-STEP_DEG)
      else if (e.key === 'ArrowRight' || e.key === 'd') turn(STEP_DEG)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Time in the green; a rising beep while locked on.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let inZone = 0
    let lastBeep = 0
    const tick = (now: number) => {
      const dt = now - last
      last = now
      const s = Math.max(0, 1 - Math.abs(angleRef.current - target) / FALLOFF_DEG)
      inZone = s >= GREEN ? inZone + dt : 0
      if (s >= GREEN && now - lastBeep > BEEP_MS) {
        lastBeep = now
        playSound('signal-beep')
      }
      setHeld(inZone)
      if (inZone >= HOLD_MS && !done.current) {
        done.current = true
        finish.current()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return (
    <div className="flex flex-col gap-3" data-testid="task-dish-align">
      <svg
        viewBox="0 0 480 200"
        className="w-full cursor-ew-resize touch-none select-none"
        shapeRendering="crispEdges"
        onPointerDown={(e) => {
          drag.current = e.clientX
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return
          turn((e.clientX - drag.current) * DRAG_DEG)
          drag.current = e.clientX
        }}
        onPointerUp={() => (drag.current = null)}
        role="img"
        aria-label="Dish: turn it with the arrow keys or by dragging"
      >
        <rect x="0" y="0" width="480" height="200" className="fill-bg" />
        <rect x="200" y="150" width="80" height="16" className="fill-border-strong" />
        <rect x="234" y="110" width="12" height="40" className="fill-muted" />
        <g transform={`rotate(${angle - 90} 240 110)`}>
          <rect x="180" y="96" width="120" height="14" className="fill-primary" />
          <rect x="196" y="84" width="88" height="12" className="fill-muted" />
          <rect x="236" y="48" width="8" height="40" className="fill-accent" />
        </g>
        <text x="16" y="28" className="fill-muted font-mono text-[14px]">
          {Math.round(angle)}°
        </text>
      </svg>
      <div className="flex items-center gap-3">
        <span className="label-caps w-20 text-sm text-muted">Signal</span>
        <SegmentBar
          share={signal}
          fill={signal >= GREEN ? 'bg-success' : 'bg-alert'}
          segments={20}
          height="h-4"
          className="flex-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="label-caps w-20 text-sm text-muted">Lock</span>
        <SegmentBar share={held / HOLD_MS} fill="bg-accent" segments={20} className="flex-1" />
      </div>
    </div>
  )
}
