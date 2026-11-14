import type { Readiness } from '@/engine/planningHints'

const LOOK = {
  green: { cls: 'border-success/50 bg-success/10 text-success', text: 'Ready' },
  amber: { cls: 'border-alert/50 bg-alert/10 text-alert', text: 'Warnings' },
  red: { cls: 'border-danger/50 bg-danger/10 text-danger', text: 'Not ready' },
} as const

/** Top-bar chip: launch readiness from runLaunchCheck. */
export function ReadinessChip({ readiness }: { readiness: Readiness }) {
  const look = LOOK[readiness.level]
  return (
    <span
      data-testid="readiness-chip"
      data-level={readiness.level}
      className={`flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs ${look.cls}`}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      Launch: {look.text}
      <span className="text-subtle">
        {readiness.fails} fail · {readiness.warns} warn
      </span>
    </span>
  )
}
