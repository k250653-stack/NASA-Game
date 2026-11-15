import { AnimatePresence, motion } from 'motion/react'
import type { LogEntry } from '@/engine/types'
import { Icon } from '@/ui/Icon'
import type { DayInfo, Gauge } from './missionRun'
import type { Toast } from './useMissionRun'

const PIXEL_BOX = 'border border-border-strong bg-bg/90'
const BAR: Record<Gauge['status'], string> = {
  ok: 'bg-accent',
  low: 'bg-alert',
  critical: 'bg-danger',
}
/** Log lines shown, newest last; older ones get dimmer text tokens. */
const LOG_LINES = 4
const LOG_TONES = ['text-subtle', 'text-subtle', 'text-muted', 'text-primary']
const LOG_MAX_CHARS = 84

/** Top-left: day counter and phase; on Mars also the signal delay. */
export function DayBadge({ info }: { info: DayInfo }) {
  return (
    <div className={`${PIXEL_BOX} absolute top-4 left-4 px-3 py-2`} data-testid="mission-day">
      <p className="font-title text-xl tracking-wider text-primary uppercase">
        Day <span className="font-mono tabular-nums">{info.day}</span> /{' '}
        <span className="font-mono tabular-nums">{info.totalDays}</span>
        <span className="text-alert"> · {info.phaseName}</span>
      </p>
      {info.delayMin !== null && (
        <p className="font-mono text-xs text-accent tabular-nums">
          Signal delay {info.delayMin.toFixed(1)} min
        </p>
      )}
    </div>
  )
}

/** Top-right: small resource bars; amber when low, red when critical, value on hover. */
export function GaugeStrip({ gauges }: { gauges: Gauge[] }) {
  return (
    <ul
      className={`${PIXEL_BOX} absolute top-4 right-4 grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2`}
      data-testid="mission-gauges"
    >
      {gauges.map((g) => (
        <li
          key={g.id}
          title={`${g.label}: ${g.value}`}
          className="flex items-center gap-2"
          data-testid={`gauge-${g.id}`}
          data-status={g.status}
        >
          <Icon
            name={g.icon}
            size={14}
            className={
              g.status === 'ok' ? 'text-muted' : g.status === 'low' ? 'text-alert' : 'text-danger'
            }
          />
          <span className="w-14 font-title text-xs tracking-wide text-muted uppercase">
            {g.label}
          </span>
          <span className="h-2 w-20 bg-surface">
            <span
              className={`block h-full ${BAR[g.status]}`}
              style={{ width: `${Math.round(g.share * 100)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Bottom-left: the last few log lines. */
export function MissionLog({ log }: { log: readonly LogEntry[] }) {
  const lines = log.slice(-LOG_LINES)
  const offset = LOG_LINES - lines.length
  return (
    <ol
      className="pointer-events-none absolute bottom-10 left-4 max-w-[46vw] space-y-0.5"
      data-testid="mission-log"
    >
      {lines.map((l, i) => (
        <li
          key={`${log.length - lines.length + i}`}
          className={`truncate bg-bg/80 px-2 py-0.5 font-mono text-xs ${LOG_TONES[i + offset]}`}
        >
          Day {l.day} ·{' '}
          {l.text.length > LOG_MAX_CHARS ? `${l.text.slice(0, LOG_MAX_CHARS - 1)}…` : l.text}
        </li>
      ))}
    </ol>
  )
}

interface ControlsProps {
  canAdvance: boolean
  fastForward: boolean
  onNext: () => void
  onFastForward: (on: boolean) => void
}

const BTN =
  'border px-4 py-2 font-title text-lg tracking-widest uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-border disabled:text-subtle'

/** Bottom-right: Next Turn, and Fast-Forward that becomes Stop while running. */
export function TurnControls({ canAdvance, fastForward, onNext, onFastForward }: ControlsProps) {
  return (
    <div className="absolute right-4 bottom-4 flex gap-2">
      <button
        type="button"
        className={`${BTN} border-accent bg-bg/90 text-accent hover:bg-accent/10`}
        disabled={!canAdvance || fastForward}
        onClick={onNext}
        data-testid="next-turn"
      >
        Next turn
      </button>
      {fastForward ? (
        <button
          type="button"
          className={`${BTN} border-danger bg-bg/90 text-danger hover:bg-danger/10`}
          onClick={() => onFastForward(false)}
          data-testid="stop-ff"
        >
          ■ Stop
        </button>
      ) : (
        <button
          type="button"
          className={`${BTN} border-alert bg-bg/90 text-alert hover:bg-alert/10`}
          disabled={!canAdvance}
          onClick={() => onFastForward(true)}
          data-testid="fast-forward"
        >
          Fast-forward
        </button>
      )}
    </div>
  )
}

/** Short result line after the player's action. */
export function ResultToast({ toast }: { toast: Toast | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.p
          key={toast.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`absolute top-24 left-1/2 -translate-x-1/2 border bg-bg/95 px-4 py-2 font-title text-lg tracking-wide ${toast.ok ? 'border-success text-success' : 'border-danger text-danger'}`}
          data-testid="result-toast"
          data-ok={toast.ok}
        >
          {toast.ok ? '✓' : '✗'} {toast.text}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
