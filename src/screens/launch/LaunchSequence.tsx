import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { createRng } from '@/engine/rng'
import type { Destination, Rocket } from '@/schemas'
import { Button } from '@/ui/Button'
import { setAmbience } from '@/ui/ambience'
import { shakeScreen } from '@/ui/feel'
import { playSound } from '@/ui/sound'
import { RocketArt } from '@/ui/RocketArt'
import { rocketSize } from '@/ui/rocketSprite'
import { TransitMap } from './TransitMap'

/** Timing of the sequence, in ms. Kept short: it plays every launch. */
const TICK_MS = 300
const COUNTDOWN_FROM = 10
const LIFTOFF_MS = 2200
const STAGE_SEP_MS = 1200
const TRANSIT_MS = 5000
const REDUCED_MS = 600

type Stage = 'countdown' | 'liftoff' | 'transit'

interface LaunchSequenceProps {
  rocket: Rocket
  destination: Destination
  onDone: () => void
}

/** Countdown, lift-off, stage separation, then the transit map. Skippable; reduced motion skips. */
export function LaunchSequence({ rocket, destination, onDone }: LaunchSequenceProps) {
  const reduced = useReducedMotion()
  const [stage, setStage] = useState<Stage>('countdown')
  const [count, setCount] = useState(COUNTDOWN_FROM)
  const [progress, setProgress] = useState(0)
  const done = useRef(false)
  const finish = useRef(onDone)
  useEffect(() => {
    finish.current = onDone
  }, [onDone])
  const end = () => {
    if (done.current) return
    done.current = true
    playSound('success')
    finish.current()
  }
  const hasStages = !rocket.id.startsWith('light')
  // Smoke puffs at fixed, seeded positions (no Math.random).
  const puffs = useMemo(() => {
    const rng = createRng(4)
    return Array.from({ length: 18 }, () => ({
      x: rng.int(-90, 90),
      y: rng.int(0, 40),
      s: rng.int(6, 14),
      d: rng.next() * 0.6,
    }))
  }, [])

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => {
        if (!done.current) {
          done.current = true
          finish.current()
        }
      }, REDUCED_MS)
      return () => clearTimeout(t)
    }
    const timers: Array<ReturnType<typeof setTimeout>> = []
    for (let i = 1; i <= COUNTDOWN_FROM; i++)
      timers.push(
        setTimeout(() => {
          setCount(COUNTDOWN_FROM - i)
          playSound('countdown-beep')
        }, i * TICK_MS),
      )
    const liftoffAt = COUNTDOWN_FROM * TICK_MS
    timers.push(
      setTimeout(() => {
        setStage('liftoff')
        void setAmbience('launch')
        playSound('launch')
        shakeScreen()
      }, liftoffAt),
    )
    const transitAt = liftoffAt + LIFTOFF_MS
    timers.push(setTimeout(() => setStage('transit'), transitAt))
    const steps = 50
    for (let i = 1; i <= steps; i++)
      timers.push(setTimeout(() => setProgress(i / steps), transitAt + (TRANSIT_MS * i) / steps))
    timers.push(
      setTimeout(
        () => {
          if (!done.current) {
            done.current = true
            playSound('success')
            finish.current()
          }
        },
        transitAt + TRANSIT_MS + 300,
      ),
    )
    return () => timers.forEach(clearTimeout)
  }, [reduced])

  return (
    <div
      data-overlay
      data-testid="launch-sequence"
      data-stage={reduced ? 'reduced' : stage}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-hidden bg-bg"
    >
      <Button
        className="absolute top-6 right-6"
        variant="secondary"
        onClick={end}
        data-testid="skip-launch"
      >
        Skip ›
      </Button>
      {reduced ? (
        <p className="font-display text-2xl text-primary">
          Lift-off. On the way to {destination.name}.
        </p>
      ) : stage === 'transit' ? (
        <TransitMap destination={destination} progress={progress} durationS={TRANSIT_MS / 1000} />
      ) : (
        <div className="relative flex h-[26rem] w-80 items-end justify-center">
          {stage === 'countdown' && (
            <p
              data-testid="countdown"
              className="absolute top-0 font-mono text-7xl text-accent tabular-nums"
            >
              T−{count}
            </p>
          )}
          <motion.div
            className="relative z-10 flex flex-col items-center"
            animate={
              stage === 'liftoff'
                ? { y: -520, x: 0 }
                : count <= 3
                  ? { x: [0, -3, 3, -2, 2, 0], transition: { repeat: Infinity, duration: 0.25 } }
                  : { x: 0 }
            }
            transition={
              stage === 'liftoff' ? { duration: LIFTOFF_MS / 1000, ease: 'easeIn' } : undefined
            }
          >
            {/* Engines ignite at lift-off: the flame version of the same rocket. */}
            <RocketArt
              size={rocketSize(rocket)}
              scale={1}
              flame={stage === 'liftoff'}
              className="z-10"
            />
            {hasStages && (
              <motion.div
                className="h-10 w-12 rounded-sm border border-border-strong bg-panel-raised"
                animate={stage === 'liftoff' ? { y: [0, 0, 260], opacity: [1, 1, 0] } : {}}
                transition={{
                  duration: LIFTOFF_MS / 1000,
                  times: [0, STAGE_SEP_MS / LIFTOFF_MS, 1],
                }}
                aria-label="First stage"
              />
            )}
          </motion.div>
          {count <= 2 &&
            puffs.map((p, i) => (
              <motion.span
                key={i}
                className="absolute bottom-0 bg-muted/60"
                style={{ width: p.s, height: p.s, left: `calc(50% + ${p.x}px)` }}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 0.8, 0], y: -p.y - 30, x: p.x / 3 }}
                transition={{ duration: 1.2, delay: p.d, repeat: Infinity }}
              />
            ))}
          <div className="absolute bottom-0 h-3 w-64 rounded-sm bg-border-strong" aria-hidden />
        </div>
      )}
      <p className="font-mono text-sm text-subtle">
        {rocket.name} → {destination.name}
      </p>
    </div>
  )
}
