import { useEffect } from 'react'
import { motion } from 'motion/react'
import { useStore } from '@/store'
import { AstronautPicker } from './menu/AstronautPicker'
import { MenuBackground } from './menu/MenuBackground'

/** After PLAY GAME: pick the astronaut, then walk into the HQ. Esc goes back to the menu. */
export default function ChooseAstronaut() {
  const appearance = useStore((s) => s.game.playerAppearance)
  const setAppearance = useStore((s) => s.setPlayerAppearance)
  const setPhase = useStore((s) => s.setPhase)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhase('title')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPhase])

  return (
    <main className="relative min-h-screen overflow-hidden" data-testid="choose-astronaut">
      <MenuBackground />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center gap-10"
        >
          <h1 className="text-center font-title text-4xl font-medium tracking-[0.3em] text-primary uppercase sm:text-5xl">
            Choose your astronaut
          </h1>
          <AstronautPicker
            value={appearance}
            onChoose={(id) => {
              setAppearance(id)
              setPhase('hq')
            }}
          />
          <p className="font-title text-sm tracking-[0.35em] text-muted uppercase">
            ← → choose · Enter confirm · Esc back
          </p>
        </motion.div>
      </div>
    </main>
  )
}
