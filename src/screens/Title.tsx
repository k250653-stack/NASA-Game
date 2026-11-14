import { motion } from 'motion/react'
import { useStore } from '@/store'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { ScreenLayout } from '@/ui/ScreenLayout'

export default function Title() {
  const nextPhase = useStore((s) => s.nextPhase)
  const setPhase = useStore((s) => s.setPhase)

  return (
    <ScreenLayout showSteps={false}>
      <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <p className="font-mono text-xs tracking-[0.4em] text-accent uppercase">
            NASA Space Apps Challenge 2026
          </p>
          <h1 className="mt-5 font-display text-7xl font-bold tracking-tight text-primary">
            Mission Control
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Design a crewed mission to the Moon or Mars, fly it day by day, and learn the real
            engineering behind every failure.
          </p>
          <div className="mt-10 flex items-center gap-3">
            <Button
              size="lg"
              onClick={nextPhase}
              data-testid="start-mission-button"
              icon={<Icon name="IconRocket" size={20} />}
            >
              Start mission
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setPhase('codex')}>
              Codex
            </Button>
          </div>
        </motion.div>
      </section>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setPhase('styleguide')}>
          Dev: UI kit
        </Button>
      </div>
    </ScreenLayout>
  )
}
