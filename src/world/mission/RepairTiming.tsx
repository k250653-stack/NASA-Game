import { useEffect, useRef, useState } from 'react'
import { Button } from '@/ui/Button'
import { playSound } from '@/ui/sound'

interface RepairTimingProps {
  label: string
  /** Success chance before the mini-game, 0-1: sizes the green zone. */
  chance: number
  bonus: number
  maxChance: number
  durationMs: number
  sweepMs: number
  minZone: number
  /** hit = the bonus applies; skipped = no bar played. */
  onDone: (hit: boolean) => void
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * Hands-on repair: stop the cyan marker inside the green zone (Space / E / click) for a bonus on
 * the success chance. The engine still rolls the outcome; this only adds to the chance.
 */
export function RepairTiming({
  label,
  chance,
  bonus,
  maxChance,
  durationMs,
  sweepMs,
  minZone,
  onDone,
}: RepairTimingProps) {
  const zone = Math.max(minZone, Math.min(1, chance))
  const zoneLeft = (1 - zone) / 2
  const [pos, setPos] = useState(0)
  const [result, setResult] = useState<'hit' | 'miss' | null>(null)
  const posRef = useRef(0)
  const doneRef = useRef(false)
  const finish = useRef(onDone)
  const stopRef = useRef<() => void>(() => {})
  useEffect(() => {
    finish.current = onDone
  }, [onDone])

  // Marker sweeps back and forth; after durationMs it stops by itself (a miss).
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = now - t0
      const phase = (t / sweepMs) % 2
      const p = phase < 1 ? phase : 2 - phase
      posRef.current = p
      setPos(p)
      if (t >= durationMs) return stop()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const stop = () => {
      if (doneRef.current) return
      doneRef.current = true
      cancelAnimationFrame(raf)
      const p = posRef.current
      const hit = p >= zoneLeft && p <= zoneLeft + zone
      setResult(hit ? 'hit' : 'miss')
      playSound(hit ? 'minigame-hit' : 'minigame-miss')
      setTimeout(() => finish.current(hit), 700)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key.toLowerCase() !== 'e') return
      e.preventDefault()
      e.stopPropagation()
      stop()
    }
    window.addEventListener('keydown', onKey, true)
    stopRef.current = stop
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [durationMs, sweepMs, zone, zoneLeft])
  const skip = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone(false)
  }

  const boosted = Math.max(chance, Math.min(maxChance, chance + bonus))
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70"
      data-testid="repair-timing"
    >
      <div className="pixel-panel w-[min(36rem,92vw)] px-6 py-5">
        <p className="label-caps text-sm text-accent">Hands-on repair</p>
        <h2 className="label-caps text-2xl text-primary">{label}</h2>
        <p className="mt-1 text-sm text-muted">
          Stop the marker in the green zone:{' '}
          <span className="font-mono text-primary tabular-nums">{pct(chance)}</span> →{' '}
          <span className="font-mono text-success tabular-nums">{pct(boosted)}</span>
        </p>
        <button
          type="button"
          onClick={() => stopRef.current()}
          aria-label="Stop the marker"
          className="relative mt-4 block h-10 w-full border-2 border-border-strong bg-alert/80"
          data-testid="repair-bar"
        >
          <span
            className="absolute inset-y-0 bg-success"
            style={{ left: pct(zoneLeft), width: pct(zone) }}
          />
          <span
            className="absolute -inset-y-1.5 w-1.5 -translate-x-1/2 bg-accent"
            style={{ left: `${pos * 100}%` }}
          />
        </button>
        <div className="mt-4 flex items-center justify-between">
          <p className="label-caps text-base" aria-live="polite">
            {result === 'hit' && (
              <span className="text-success">Hit! +{Math.round(bonus * 100)} points</span>
            )}
            {result === 'miss' && <span className="text-danger">Missed: normal chance</span>}
            {!result && <span className="text-subtle">Space / E / click</span>}
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={result !== null}
            onClick={skip}
            data-testid="repair-skip"
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  )
}
