import { motion } from 'motion/react'
import type { MissionScore } from '@/engine/score'
import type { MissionState } from '@/engine/types'
import { AssetImage } from '@/ui/AssetImage'

const TITLE: Record<MissionScore['outcome'], { text: string; tone: string }> = {
  success: { text: 'Mission complete', tone: 'text-success' },
  partial: { text: 'Mission complete', tone: 'text-alert' },
  failed: { text: 'Mission failed', tone: 'text-danger' },
}

/** Full-screen title card when the mission ends: the outcome scene, title and reason. */
export function MissionEndCard({
  run,
  outcome,
}: {
  run: MissionState
  outcome: MissionScore['outcome']
}) {
  const t = TITLE[outcome]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg"
      data-testid="mission-end"
      data-outcome={outcome === 'failed' ? 'failed' : 'complete'}
    >
      <AssetImage
        kind="backgrounds"
        id={`outcome-${outcome}`}
        ext="png"
        label={t.text}
        className="h-[240px] w-[480px] border-2 border-border-strong 2xl:h-[480px] 2xl:w-[960px]"
      />
      <p className={`label-caps text-6xl tracking-[0.3em] ${t.tone}`}>{t.text}</p>
      <p className="max-w-xl text-center font-mono text-sm text-muted">
        {outcome === 'failed'
          ? (run.failReason ?? 'The mission could not continue.')
          : `All ${run.day} days flown. Debrief next.`}
      </p>
    </motion.div>
  )
}
