/**
 * Main-menu rocket launch: the timeline (ms from pressing PLAY / SANDBOX) and a clock hook that
 * plays it, fires its sounds, lets any key or click skip it, and fades to black at the end.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '@/ui/sound'

export const LAUNCH = {
  /** Menu text fades out. */
  textFadeMs: 300,
  /** Three countdown beeps. */
  beeps: [350, 700, 1050],
  /** Engines light: flame sprite, rumble, shake, smoke clouds. */
  ignition: 1300,
  /** The rocket starts to rise (slowly, then faster). */
  liftoff: 1700,
  /** Rise time until it is off the top of the screen. */
  riseMs: 2600,
  /** Screen shake after ignition. */
  shakeMs: 900,
  /** Fade to black, then the game continues. */
  fadeAt: 4100,
  end: 4500,
  /** Skipping or reduced motion: just a short fade. */
  quickFadeMs: 300,
} as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** 0..1 progress of the rise; eases in so it starts slow and accelerates. */
export function riseProgress(t: number): number {
  const u = clamp01((t - LAUNCH.liftoff) / LAUNCH.riseMs)
  return u ** 2.6
}

/** Black overlay opacity from the timeline. */
export function fadeAmount(t: number): number {
  return clamp01((t - LAUNCH.fadeAt) / (LAUNCH.end - LAUNCH.fadeAt))
}

export interface MenuLaunch {
  /** Ms since the launch started, or null when the menu is idle. */
  t: number | null
  /** Black overlay: opacity and how fast it changes. */
  fade: { opacity: number; ms: number }
  start: (onDone: () => void) => void
}

/**
 * Runs the launch on requestAnimationFrame. With reduced motion the whole thing is a short fade.
 * Any key or click during the launch skips to that short fade.
 */
export function useMenuLaunch(reduced: boolean): MenuLaunch {
  const [t, setT] = useState<number | null>(null)
  const [fade, setFade] = useState({ opacity: 0, ms: 0 })
  const done = useRef<(() => void) | null>(null)
  const raf = useRef(0)
  const fired = useRef(new Set<number>())

  const finish = useCallback(() => {
    const cb = done.current
    done.current = null
    cancelAnimationFrame(raf.current)
    cb?.()
  }, [])

  /** Short fade to black, then continue. */
  const quickOut = useCallback(() => {
    cancelAnimationFrame(raf.current)
    setFade({ opacity: 1, ms: LAUNCH.quickFadeMs })
    window.setTimeout(finish, LAUNCH.quickFadeMs)
  }, [finish])

  const start = useCallback(
    (onDone: () => void) => {
      if (done.current) return
      done.current = onDone
      if (reduced) {
        quickOut()
        return
      }
      fired.current.clear()
      const t0 = performance.now()
      const tick = (now: number) => {
        const tt = now - t0
        setT(tt)
        for (const at of [...LAUNCH.beeps, LAUNCH.ignition]) {
          if (tt >= at && !fired.current.has(at)) {
            fired.current.add(at)
            playSound(at === LAUNCH.ignition ? 'launch' : 'countdown-beep')
          }
        }
        setFade({ opacity: fadeAmount(tt), ms: 0 })
        if (tt >= LAUNCH.end) finish()
        else raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    },
    [reduced, quickOut, finish],
  )

  // Any key or click skips the launch.
  useEffect(() => {
    if (t === null) return
    const skip = () => {
      if (done.current) quickOut()
    }
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [t === null, quickOut]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return { t, fade, start }
}
