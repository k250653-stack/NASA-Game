import { useMemo, useState } from 'react'
import { analyzeCauses } from '@/engine/causes'
import { compareRuns } from '@/engine/compareRuns'
import { computeScore } from '@/engine/score'
import { usePlanning } from '@/screens/planning/usePlanning'
import { useStore } from '@/store'
import { latestRuns, useRunHistory } from '@/store/runHistory'
import { PopupPanel } from '../PopupPanel'
import { CauseList } from './CauseList'
import { changeLines, graphSeries, newMission, redesignAndRetry } from './debrief'
import { CrewReactions, H3, RunCompare, ScoreBreakdown } from './DebriefSections'
import { MissionGraph } from './MissionGraph'

const OUTCOME = {
  success: { label: 'Success', text: 'text-success' },
  partial: { label: 'Partial', text: 'text-alert' },
  failed: { label: 'Failed', text: 'text-danger' },
} as const
const MAX_STARS = 3
const BTN =
  'border px-4 py-2 font-title text-lg tracking-widest uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** The mission debrief over the Briefing room: score, causes, graph, crew, replay buttons. */
export function DebriefPopup({ onClose }: { onClose: () => void }) {
  const p = usePlanning()
  const run = useStore((s) => s.mission.run)
  const trades = useStore((s) => s.design.tradesAccepted)
  const setPhase = useStore((s) => s.setPhase)
  const runs = useRunHistory((s) => s.runs)
  const [newEvents, setNewEvents] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)

  const view = useMemo(() => {
    if (!run || !p.design) return null
    const opts = { tradesCount: trades }
    const score = computeScore(run, p.design, p.content, opts)
    const causes = analyzeCauses(run, p.design, p.content, opts)
    const { last, previous } = latestRuns(runs)
    // The newest history entry is this run; compare with the one before it for this scenario.
    const prev = last?.scenarioId === p.design.scenarioId ? previous : undefined
    const cmp = prev
      ? compareRuns(
          { design: prev.design, score: prev.score },
          { design: p.design, score },
          p.content,
        )
      : null
    return { score, causes, cmp, series: graphSeries(run) }
  }, [run, p.design, p.content, trades, runs])

  if (!run || !p.design || !view) return null
  const { score, causes, cmp, series } = view
  const scenario = p.content.scenarios.find((s) => s.id === p.design?.scenarioId)
  const outcome = OUTCOME[score.outcome]

  return (
    <PopupPanel onClose={onClose} label="Mission debrief">
      <div className="p-6" data-testid="debrief" data-outcome={score.outcome}>
        <header className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-border pb-4">
          <div>
            <p className="font-title text-sm tracking-widest text-subtle uppercase">
              Mission debrief · {p.destination?.name}
            </p>
            <h2 className="font-title text-4xl tracking-wide text-primary uppercase">
              {scenario?.name ?? 'Mission'}
            </h2>
          </div>
          <p
            className={`font-title text-3xl tracking-[0.25em] uppercase ${outcome.text}`}
            data-testid="debrief-outcome"
          >
            {outcome.label}
          </p>
          <p
            className="font-title text-3xl tracking-widest"
            aria-label={`${score.stars} of ${MAX_STARS} stars`}
          >
            {Array.from({ length: MAX_STARS }, (_, i) => (
              <span key={i} className={i < score.stars ? 'text-alert' : 'text-border-strong'}>
                ★
              </span>
            ))}
          </p>
          <p className="ml-auto font-title text-4xl text-primary" data-testid="debrief-total">
            <span className="font-mono tabular-nums">{score.total}</span>
            <span className="text-xl text-subtle"> / 100</span>
          </p>
        </header>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
          <div className="space-y-6">
            <ScoreBreakdown score={score} />
            <section>
              <h3 className={H3}>Mission graph</h3>
              <div className="mt-2">
                <MissionGraph series={series} days={run.day} />
              </div>
            </section>
            {cmp && <RunCompare cmp={cmp} changes={changeLines(cmp, p.design, p.content)} />}
          </div>
          <div className="space-y-6">
            <section>
              <h3 className={H3}>What happened</h3>
              <div className="mt-2">
                <CauseList causes={causes} />
              </div>
            </section>
            <section>
              <h3 className={H3}>Crew</h3>
              <div className="mt-2">
                <CrewReactions crew={p.team} run={run} outcome={score.outcome} />
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            className={`${BTN} border-accent text-accent hover:bg-accent/10`}
            onClick={() => redesignAndRetry(newEvents)}
            data-testid="redesign-retry"
          >
            Redesign &amp; retry
          </button>
          <label className="flex items-center gap-2 font-mono text-xs text-muted">
            <input
              type="checkbox"
              checked={newEvents}
              onChange={(e) => setNewEvents(e.target.checked)}
              className="accent-alert"
              data-testid="new-random-events"
            />
            New random events
          </label>
          <span className="ml-auto flex gap-3">
            {confirmNew ? (
              <>
                <span className="self-center text-sm text-alert">
                  Start over? This plan is lost.
                </span>
                <button
                  type="button"
                  className={`${BTN} border-danger text-danger hover:bg-danger/10`}
                  onClick={newMission}
                  data-testid="confirm-new-mission"
                >
                  Yes, new mission
                </button>
                <button
                  type="button"
                  className={`${BTN} border-border-strong text-muted hover:text-primary`}
                  onClick={() => setConfirmNew(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${BTN} border-alert text-alert hover:bg-alert/10`}
                onClick={() => setConfirmNew(true)}
                data-testid="new-mission"
              >
                New mission
              </button>
            )}
            <button
              type="button"
              className={`${BTN} border-border-strong text-muted hover:text-primary`}
              onClick={() => setPhase('title')}
              data-testid="debrief-main-menu"
            >
              Main menu
            </button>
          </span>
        </footer>
      </div>
    </PopupPanel>
  )
}
