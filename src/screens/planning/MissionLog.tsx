import type { LogEntry, LogKind } from '@/engine/types'

const KIND_CLASS: Record<LogKind, string> = {
  info: 'text-muted',
  science: 'text-accent',
  warning: 'text-alert',
  alarm: 'text-danger',
  event: 'text-primary',
  decision: 'text-muted',
}

const HANDLED: Record<NonNullable<LogEntry['handledBy']>, string> = {
  player: 'you',
  ai: 'AI',
  'standing-orders': 'orders',
}

/** Newest-first mission log with explanations. */
export function MissionLog({ log }: { log: readonly LogEntry[] }) {
  return (
    <ol className="max-h-96 overflow-y-auto rounded-md border border-border text-sm">
      {[...log].reverse().map((entry, i) => (
        <li
          key={log.length - i}
          className="flex gap-3 border-b border-border px-3 py-1.5 last:border-b-0"
        >
          <span className="w-12 shrink-0 font-mono text-xs text-subtle tabular-nums">
            d{entry.day}
          </span>
          <span className={KIND_CLASS[entry.kind]}>
            {entry.handledBy && (
              <span className="mr-1 font-mono text-[10px] text-subtle uppercase">
                [{HANDLED[entry.handledBy]}]
              </span>
            )}
            {entry.text}
          </span>
        </li>
      ))}
    </ol>
  )
}
