import { useEffect, useRef, useState } from 'react'
import { AssetImage } from '@/ui/AssetImage'
import { useSettings } from '@/ui/settingsStore'

/** The launchpad image is 480x270, drawn "cover" and anchored right (see MenuBackground). */
const BG_W = 480
const BG_H = 270
/** Where the rocket's base touches the empty spot on the pad, in launchpad-image pixels. */
const PAD = { x: 350, y: 238 }
/** Rocket sprite size (rocket-medium.png). */
const ROCKET_W = 44
const ROCKET_H = 192

/** Vapour puffs at the base: left offset (sprite px), delay and drift. */
const PUFFS = [
  { left: 8, delay: '0s', drift: '-10px' },
  { left: 18, delay: '1.3s', drift: '6px' },
  { left: 30, delay: '2.4s', drift: '12px' },
  { left: 38, delay: '3.3s', drift: '-6px' },
]

/**
 * A rocket standing on the pad, positioned with the same cover/right-anchor maths as the
 * background and drawn at a whole-number scale so its pixels stay sharp. Sits behind the menu.
 */
export function MenuRocket() {
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

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden>
      {box.w > 0 && (
        <div
          className="absolute"
          data-testid="menu-rocket"
          style={{
            width: ROCKET_W * scale,
            height: ROCKET_H * scale,
            left: Math.round(baseX - (ROCKET_W * scale) / 2),
            top: Math.round(baseY - ROCKET_H * scale),
          }}
        >
          <AssetImage
            kind="sprites"
            id="rocket-medium"
            ext="png"
            alt=""
            className="size-full [image-rendering:pixelated]"
          />
          {!reduced &&
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
        </div>
      )}
    </div>
  )
}
