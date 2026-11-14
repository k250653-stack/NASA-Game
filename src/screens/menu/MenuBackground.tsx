import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { AssetImage } from '@/ui/AssetImage'

const BACKGROUNDS = ['menu-launchpad', 'menu-station'] as const
/** Time each background stays up before crossfading to the next. */
const HOLD_MS = 12_000
const FADE_S = 2.5

/** Full-screen pixel-art backdrop that slowly crossfades, darkened on the left for the text. */
export function MenuBackground() {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setShown((i) => (i + 1) % BACKGROUNDS.length), HOLD_MS)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className="absolute inset-0 bg-bg" aria-hidden data-testid="menu-background">
      {BACKGROUNDS.map((id, i) => (
        <motion.div
          key={id}
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: i === shown ? 1 : 0 }}
          transition={{ duration: FADE_S, ease: 'easeInOut' }}
          data-shown={i === shown}
        >
          <AssetImage
            kind="backgrounds"
            id={id}
            ext="png"
            alt=""
            className="size-full object-cover object-right [image-rendering:pixelated]"
          />
        </motion.div>
      ))}
      <div className="absolute inset-0 bg-linear-to-r from-bg via-bg/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-bg/80 to-transparent" />
    </div>
  )
}
