import { useEffect, useRef, useState } from 'react'
import { RocketArt } from '@/ui/RocketArt'
import { ROCKET_ART } from '@/ui/rocketSprite'
import { useSettings } from '@/ui/settingsStore'
import { launchPuffs } from './launchSmoke'
import { LAUNCH, riseProgress } from './menuLaunch'

/** The launchpad image is 480x270, drawn "cover" and anchored right (see MenuBackground). */
const BG_W = 480
const BG_H = 270
/** Where the rocket's base touches the empty spot on the pad, in launchpad-image pixels. */
const PAD = { x: 350, y: 238 }
const SIZE = 'medium' as const
const ROCKET_W = ROCKET_ART[SIZE].w
const ROCKET_H = ROCKET_ART[SIZE].h

/** Idle vapour puffs at the base: left offset (sprite px), delay and drift. */
const PUFFS = [
  { left: 8, delay: '0s', drift: '-10px' },
  { left: 18, delay: '1.3s', drift: '6px' },
  { left: 30, delay: '2.4s', drift: '12px' },
  { left: 38, delay: '3.3s', drift: '-6px' },
]

interface MenuRocketProps {
  /** Ms since PLAY / SANDBOX started the launch, or null while the menu is idle. */
  launchT: number | null
}

/**
 * A rocket standing on the pad, positioned with the same cover/right-anchor maths as the
 * background and drawn at a whole-number scale so its pixels stay sharp. Idle: steam and a slow
 * beacon. Launching: vapour, ignition (flame art) with smoke clouds, then it climbs off screen.
 */
export function MenuRocket({ launchT }: MenuRocketProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const reduced = useSettings((s) => s.reducedMotion)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const bgScale = Math.max(box.w / BG_W, box.h / BG_H)
  // Whole-number scale, rounded up so the rocket matches the size of the pad and gantry.
  const scale = Math.max(1, Math.ceil(bgScale - 0.01))
  const baseX = box.w - BG_W * bgScale + PAD.x * bgScale
  const baseY = (box.h - BG_H * bgScale) / 2 + PAD.y * bgScale
  const t = launchT
  const launching = t !== null
  const ignited = launching && t >= LAUNCH.ignition
  // Climb far enough for the whole rocket and its flame to leave the top of the screen.
  const travel = baseY + ROCKET_H * scale * 2.5
  const lift = launching ? Math.round(riseProgress(t) * travel) : 0
  // A small rumble while the engines build up, before it climbs away.
  const shaking = ignited && !reduced && t < LAUNCH.liftoff + 400
  const jitter = shaking ? (Math.floor(t / 40) % 2 ? scale : -scale) : 0
  const puffs = launching ? launchPuffs(t, baseX, baseY, scale, travel) : []

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden>
      {box.w > 0 && (
        <>
          {puffs.map((p) => (
            <span
              key={p.key}
              className={`absolute block ${p.tone}`}
              style={{ left: p.x, top: p.y, width: p.size, height: p.size, opacity: p.opacity }}
            />
          ))}
          <div
            className="absolute"
            data-testid="menu-rocket"
            data-launch={launching ? (ignited ? 'ignited' : 'countdown') : 'idle'}
            style={{
              left: Math.round(baseX - (ROCKET_W * scale) / 2) + jitter,
              top: Math.round(baseY - ROCKET_H * scale) - lift,
            }}
          >
            <RocketArt size={SIZE} scale={scale} flame={ignited} />
            {!reduced &&
              !launching &&
              PUFFS.map((p) => (
                <span
                  key={p.left}
                  className="menu-vapour absolute bottom-0 block rounded-full bg-primary/40"
                  style={{
                    left: p.left * scale,
                    width: 6 * scale,
                    height: 6 * scale,
                    animation: `vapour-rise 4s ease-out ${p.delay} infinite`,
                    ['--drift' as string]: p.drift,
                  }}
                />
              ))}
            {!ignited && (
              <span
                className="menu-beacon absolute rounded-full bg-danger"
                style={{
                  left: (ROCKET_W / 2) * scale - scale,
                  top: 6 * scale,
                  width: 2 * scale,
                  height: 2 * scale,
                  animation: reduced ? undefined : 'beacon-blink 2.4s steps(1, end) infinite',
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
