import { useEffect, useState } from 'react'
import { AssetImage } from '@/ui/AssetImage'
import { PopupPanel } from '../PopupPanel'
import { reopenProblem, useProblems, type ProblemEntry, type ProblemStatus } from './problems'

const TABS = ['all', 'pending', 'resolved', 'failed'] as const
type Tab = (typeof TABS)[number]

const STATUS: Record<ProblemStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'text-alert' },
  resolved: { label: 'Resolved ✓', tone: 'text-success' },
  failed: { label: 'Failed ✗', tone: 'text-danger' },
}

interface ListProps {
  entries: readonly ProblemEntry[]
  stationLabel: (kind: string) => string
  /** Pending entries reopen their popup when clicked (off in the debrief). */
  interactive?: boolean
}

/** Logbook rows: day, event + picture, place, who, option, crew, result, resource changes. */
export function ProblemList({ entries, stationLabel, interactive = false }: ListProps) {
  if (entries.length === 0) return <p className="py-4 text-sm text-muted">No entries.</p>
  return (
    <ol className="divide-y-2 divide-border" data-testid="problem-list">
      {entries.map((e) => {
        const s = STATUS[e.status]
        const body = (
          <div className="flex gap-3 py-2 text-left">
            <AssetImage
              kind="events"
              id={`event-${e.event.id}`}
              label={e.event.title}
              className="h-[60px] w-[120px] shrink-0 border-2 border-border-strong"
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-sm text-subtle tabular-nums">Day {e.day}</span>
                <span className="label-caps text-base text-primary">{e.event.title}</span>
                <span className={`label-caps text-sm ${s.tone}`}>{s.label}</span>
              </p>
              <p className="text-sm text-muted">
                {stationLabel(e.station)}
                {e.handledBy && <> · {e.handledBy}</>}
                {e.option && <> · {e.option}</>}
                {e.crewName && <> · {e.crewName}</>}
              </p>
              {e.changes.length > 0 && (
                <p className="font-mono text-xs text-muted">{e.changes.join(' · ')}</p>
              )}
            </div>
          </div>
        )
        return (
          <li key={e.uid} data-status={e.status}>
            {interactive && e.status === 'pending' ? (
              <button
                type="button"
                className="block w-full hover:bg-alert/5"
                onClick={() => reopenProblem(e.uid)}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** The mission logbook (LOG button / L): every problem so far, with filter tabs. */
export function ProblemLogPanel({ entries, stationLabel }: Omit<ListProps, 'interactive'>) {
  const [tab, setTab] = useState<Tab>('all')
  const close = () => useProblems.setState({ logOpen: false })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  const shown = tab === 'all' ? entries : entries.filter((e) => e.status === tab)
  return (
    <PopupPanel section="Mission" title="Problems log" onClose={close}>
      <div className="mx-auto max-w-4xl px-6 py-4" data-testid="problem-log">
        <div className="flex gap-2 border-b-2 border-border pb-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`label-caps border-2 px-3 py-1 text-sm ${tab === t ? 'border-accent text-accent' : 'border-border text-muted hover:text-primary'}`}
              data-testid={`log-tab-${t}`}
            >
              {t}{' '}
              <span className="font-mono tabular-nums">
                {t === 'all' ? entries.length : entries.filter((e) => e.status === t).length}
              </span>
            </button>
          ))}
        </div>
        <ProblemList entries={shown} stationLabel={stationLabel} interactive />
      </div>
    </PopupPanel>
  )
}

interface ButtonsProps {
  pending: number
  urgent: boolean
  /** A hands-on task is waiting for the pending problem. */
  taskLabel: string | null
}

/** Right edge of the HUD: the pulsing "!" with the pending count, and the LOG button. */
export function ProblemButtons({ pending, urgent, taskLabel }: ButtonsProps) {
  const red = pending > 1 || urgent
  return (
    <div className="pointer-events-auto absolute top-1/2 right-4 flex -translate-y-1/2 flex-col items-end gap-2">
      {pending > 0 && (
        <button
          type="button"
          onClick={() => reopenProblem()}
          className={`label-caps flex animate-pulse items-center gap-2 border-2 px-3 py-2 text-xl ${red ? 'border-danger bg-danger text-bg' : 'border-alert bg-alert text-on-alert'}`}
          title={taskLabel ? `Task waiting: ${taskLabel}` : 'Reopen the problem (Q)'}
          data-testid="problem-alert"
        >
          ! <span className="font-mono tabular-nums">{pending}</span>
        </button>
      )}
      {pending > 0 && taskLabel && (
        <p className="label-caps max-w-48 border-2 border-accent bg-bg/90 px-2 py-1 text-right text-xs text-accent">
          ← Task: {taskLabel}
        </p>
      )}
      <button
        type="button"
        onClick={() => useProblems.setState({ logOpen: true })}
        className="label-caps border-2 border-border-strong bg-bg/90 px-3 py-1.5 text-sm text-primary hover:border-accent hover:text-accent"
        title="Problems log (L)"
        data-testid="open-log"
      >
        Log
      </button>
    </div>
  )
}
