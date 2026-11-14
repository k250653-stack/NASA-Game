import { useEffect, useRef } from 'react'
import { createRng } from '@/engine/rng'

/** Fixed seed: the sky looks the same every time. */
const STAR_SEED = 1969
/** One star per this many square CSS pixels. */
const AREA_PER_STAR = 9000
/** Redraw interval for twinkling, in ms (~20 fps is plenty and cheap). */
const FRAME_MS = 50

interface Star {
  x: number
  y: number
  r: number
  base: number
  speed: number
  phase: number
}

/**
 * Lightweight canvas star field behind everything. Star colour comes from the --color-star token.
 * With prefers-reduced-motion it draws once and never animates.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-star').trim()
    let stars: Star[] = []
    let raf = 0
    let last = 0

    const layout = () => {
      const dpr = window.devicePixelRatio || 1
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const rng = createRng(STAR_SEED)
      stars = Array.from({ length: Math.round((w * h) / AREA_PER_STAR) }, () => ({
        x: rng.next() * w,
        y: rng.next() * h,
        r: rng.next() < 0.9 ? 0.6 + rng.next() * 0.5 : 1.2 + rng.next() * 0.6,
        base: 0.25 + rng.next() * 0.5,
        speed: 0.4 + rng.next() * 1.2,
        phase: rng.next() * Math.PI * 2,
      }))
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = color
      for (const s of stars) {
        const twinkle = reduced ? 0 : Math.sin((t / 1000) * s.speed + s.phase) * 0.18
        ctx.globalAlpha = Math.max(0.05, Math.min(1, s.base + twinkle))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const loop = (t: number) => {
      if (t - last >= FRAME_MS) {
        last = t
        draw(t)
      }
      raf = requestAnimationFrame(loop)
    }

    const onResize = () => {
      layout()
      draw(performance.now())
    }

    onResize()
    if (!reduced) raf = requestAnimationFrame(loop)
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 size-full"
    />
  )
}
