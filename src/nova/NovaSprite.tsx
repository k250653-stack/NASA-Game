import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { getAsset } from '@/ui/assets'

/** Seconds between blinks, and the bob height in px. */
const BLINK_EVERY_MS = 3600
const BLINK_MS = 140
const BOB_PX = 4

/**
 * NOVA: a small hovering survey drone with a rounded hexagonal hull, one wide cyan visor and a
 * stub antenna. Uses public/assets/sprites/nova.png when present, else this pixel drawing.
 */
export function NovaSprite({ talking = false, size = 96 }: { talking?: boolean; size?: number }) {
  const reduced = useReducedMotion()
  const [usePng, setUsePng] = useState(true)
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (reduced) return
    let off: ReturnType<typeof setTimeout> | undefined
    const id = setInterval(() => {
      setBlink(true)
      off = setTimeout(() => setBlink(false), BLINK_MS)
    }, BLINK_EVERY_MS)
    return () => (clearInterval(id), clearTimeout(off))
  }, [reduced])

  return (
    <motion.div
      style={{ width: size, height: size }}
      animate={reduced ? {} : { y: [0, -BOB_PX, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      data-testid="nova-sprite"
      data-talking={talking}
    >
      {usePng ? (
        <motion.img
          src={getAsset('sprites', 'nova', 'png')}
          alt="NOVA"
          className="size-full [image-rendering:pixelated]"
          onError={() => setUsePng(false)}
          // Blink = a quick dim; talking = the visor glow pulses.
          animate={
            blink
              ? { filter: 'brightness(0.55)' }
              : talking && !reduced
                ? { filter: ['brightness(1)', 'brightness(1.35)', 'brightness(1)'] }
                : { filter: 'brightness(1)' }
          }
          transition={talking && !blink ? { duration: 0.35, repeat: Infinity } : { duration: 0.08 }}
        />
      ) : (
        <svg
          viewBox="0 0 32 32"
          className="size-full"
          shapeRendering="crispEdges"
          role="img"
          aria-label="NOVA"
        >
          {/* antenna */}
          <rect x="15" y="1" width="2" height="5" className="fill-border-strong" />
          <rect
            x="14"
            y="0"
            width="4"
            height="2"
            className={talking ? 'fill-alert' : 'fill-accent'}
          />
          {/* rounded hexagonal hull */}
          <path
            d="M10 6h12l5 5v9l-5 5H10l-5-5v-9z"
            className="fill-panel-raised stroke-border-strong"
            strokeWidth="1"
          />
          <path d="M11 7h10l4 4v1H7v-1z" className="fill-border-strong" />
          {/* visor */}
          <rect x="8" y="12" width="16" height="7" className="fill-bg" />
          <motion.rect
            x="9"
            y={blink ? 15 : 13}
            width="14"
            height={blink ? 1 : 5}
            className="fill-accent"
            animate={talking && !reduced ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
            transition={{ duration: 0.35, repeat: talking ? Infinity : 0 }}
          />
          {!blink && <rect x="18" y="14" width="3" height="2" className="fill-on-accent" />}
          {/* side fins and thruster glow */}
          <rect x="3" y="14" width="2" height="5" className="fill-border-strong" />
          <rect x="27" y="14" width="2" height="5" className="fill-border-strong" />
          <rect x="13" y="26" width="6" height="2" className="fill-alert/70" />
          <rect x="14" y="28" width="4" height="2" className="fill-alert/35" />
        </svg>
      )}
    </motion.div>
  )
}
