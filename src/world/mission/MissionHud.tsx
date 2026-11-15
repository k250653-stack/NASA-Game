import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { LogEntry } from '@/engine/types'
import { GaugeItem } from './GaugeItem'
import type { DayInfo, Gauge } from './missionRun'
import type { Toast } from './useMissionRun'

const PIXEL_BOX = 'border border-border-strong bg-bg/90'
/** Log lines shown, newest last; older ones get dimmer text tokens. */
const LOG_LINES = 4
const LOG_TONES = ['text-subtle', 'text-subtle', 'text-muted', 'text-primary']
const LOG_MAX_CHARS = 84

interface HudFrameProps {
  topLeft: ReactNode
  topCenter: ReactNode
  topRight: ReactNode
  bottomLeft: ReactNode
  bottomRight: ReactNode
}

/**
 * Lays the HUD out as two flex rows (top and bottom) so no piece can overlap another: the
 * middle of the top row shrinks and wraps, the ends keep their size. Clicks pass through the
 * frame; only the pieces themselves are interactive.
 */
export function HudFrame({ topLeft, topCenter, topRight, bottomLeft, bottomRight }: HudFrameProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="shrink-0">{topLeft}</div>
        <div className="flex min-w-0 flex-1 justify-center">{topCenter}</div>
        <div className="pointer-events-auto shrink-0">{topRight}</div>
      </div>
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0 max-w-[50%]">{bottomLeft}</div>
        <div className="pointer-events-auto shrink-0">{bottomRight}</div>
      </div>
    </div>
  )
}

/** Top-left: day counter and phase; on Mars also the signal delay. */
export function DayBadge({ info }: { info: DayInfo }) {
  return (
    <div className={`${PIXEL_BOX} px-3 py-2`} data-testid="mission-day">
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
      className={`${PIXEL_BOX} grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2`}
      data-testid="mission-gauges"
    >
      {gauges.map((g) => (
        <GaugeItem key={g.id} g={g} />
      ))}
    </ul>
  )
}

/** Bottom-left: the last few log lines. */
export function MissionLog({ log }: { log: readonly LogEntry[] }) {
  const lines = log.slice(-LOG_LINES)
  const offset = LOG_LINES - lines.length
  return (
    <ol className="pointer-events-none min-w-0 space-y-0.5" data-testid="mission-log">
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
    <div className="flex gap-2">
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
          className={`max-w-full border bg-bg/95 px-4 py-2 text-center font-title text-lg tracking-wide ${toast.ok ? 'border-success text-success' : 'border-danger text-danger'}`}
          data-testid="result-toast"
          data-ok={toast.ok}
        >
          {toast.ok ? '✓' : '✗'} {toast.text}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
