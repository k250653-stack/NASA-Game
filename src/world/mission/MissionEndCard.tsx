import { motion } from 'motion/react'
import type { MissionState } from '@/engine/types'

/** Full-screen pixel title card when the mission ends. */
export function MissionEndCard({ run }: { run: MissionState }) {
  const failed = run.outcome === 'failed'
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg"
      data-testid="mission-end"
      data-outcome={failed ? 'failed' : 'complete'}
    >
      <p
        className={`font-title text-6xl tracking-[0.3em] uppercase ${failed ? 'text-danger' : 'text-accent'}`}
      >
        {failed ? 'Mission failed' : 'Mission complete'}
      </p>
      <p className="max-w-xl text-center font-mono text-sm text-muted">
        {failed
          ? (run.failReason ?? 'The mission could not continue.')
          : `All ${run.day} days flown. Debrief next.`}
      </p>
    </motion.div>
  )
}
