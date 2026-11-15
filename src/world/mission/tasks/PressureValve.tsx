import { useEffect, useMemo, useRef, useState } from 'react'
import { createRng } from '@/engine/rng'
import { playSound } from '@/ui/sound'
import type { TaskProps } from './types'

/** Gauge fill per second while held, the green band's width, tries and hiss rate. */
const FILL_PER_S = 0.45
const BAND = 0.14
const TRIES = 3
const HISS_MS = 260

/** Hold E (or the mouse) to build pressure; release with the needle inside the green band. */
export function PressureValve({ seed, onComplete, onFail }: TaskProps) {
  const bandLo = useMemo(() => 0.45 + createRng(seed).next() * 0.3, [seed])
  const [level, setLevel] = useState(0)
  const [tries, setTries] = useState(TRIES)
  const [msg, setMsg] = useState<string | null>(null)
  const holding = useRef(false)
  const levelRef = useRef(0)
  const done = useRef(false)
  const triesRef = useRef(TRIES)

  const release = () => {
    if (!holding.current || done.current) return
    holding.current = false
    const v = levelRef.current
    if (v >= bandLo && v <= bandLo + BAND) {
      done.current = true
      setMsg('Pressure balanced')
      onComplete()
      return
    }
    triesRef.current -= 1
    setTries(triesRef.current)
    setMsg(v < bandLo ? 'Too low' : 'Too high')
    playSound('fail')
    levelRef.current = 0
    setLevel(0)
    if (triesRef.current <= 0) {
      done.current = true
      onFail()
    }
  }
  const press = () => {
    if (done.current) return
    holding.current = true
    setMsg(null)
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastHiss = 0
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (holding.current) {
        levelRef.current = Math.min(1, levelRef.current + FILL_PER_S * dt)
        setLevel(levelRef.current)
        if (now - lastHiss > HISS_MS) {
          lastHiss = now
          playSound('valve-hiss')
        }
        if (levelRef.current >= 1) release()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'e' || e.repeat) return
      e.preventDefault()
      e.stopPropagation()
      press()
    }
    const up = (e: KeyboardEvent) => e.key.toLowerCase() === 'e' && release()
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // release/press read refs only; the loop runs for the panel's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Needle across a half-circle gauge: 0 = left, 1 = right.
  const ang = Math.PI * (1 - level)
  const nx = 240 + Math.cos(ang) * 120
  const ny = 170 - Math.sin(ang) * 120
  const arc = (a: number, b: number) => {
    const p = (t: number) => [
      240 + Math.cos(Math.PI * (1 - t)) * 130,
      170 - Math.sin(Math.PI * (1 - t)) * 130,
    ]
    const [x1, y1] = p(a)
    const [x2, y2] = p(b)
    return `M ${x1} ${y1} A 130 130 0 0 1 ${x2} ${y2}`
  }
  return (
    <div className="flex flex-col items-center gap-2" data-testid="task-pressure-valve">
      <svg
        viewBox="0 0 480 200"
        className="w-full touch-none select-none"
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          press()
        }}
        onPointerUp={release}
        role="img"
        aria-label="Pressure gauge: hold E or the mouse, release in the green band"
      >
        <rect x="0" y="0" width="480" height="200" className="fill-bg" />
        <path d={arc(0, 1)} className="fill-none stroke-border-strong" strokeWidth="16" />
        <path
          d={arc(bandLo, bandLo + BAND)}
          className="fill-none stroke-success"
          strokeWidth="16"
        />
        <line x1="240" y1="170" x2={nx} y2={ny} className="stroke-alert" strokeWidth="6" />
        <rect x="228" y="160" width="24" height="24" className="fill-muted" />
      </svg>
      <p className="label-caps text-base" aria-live="polite">
        <span className="text-muted">Tries left </span>
        <span className="font-mono text-primary tabular-nums">{tries}</span>
        {msg && (
          <span className={msg === 'Pressure balanced' ? 'text-success' : 'text-danger'}>
            {' '}
            · {msg}
          </span>
        )}
      </p>
    </div>
  )
}
