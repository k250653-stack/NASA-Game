import { useMemo, useState } from 'react'
import { analyzeCauses } from '@/engine/causes'
import { compareRuns } from '@/engine/compareRuns'
import { computeScore } from '@/engine/score'
import { usePlanning } from '@/screens/planning/usePlanning'
import { useStore } from '@/store'
import { latestRuns, useRunHistory } from '@/store/runHistory'
import { AssetImage } from '@/ui/AssetImage'
import { Button } from '@/ui/Button'
import { PopupPanel } from '../PopupPanel'
import { CauseList } from './CauseList'
import { changeLines, graphSeries, newMission, redesignAndRetry } from './debrief'
import { CrewReactions, H3, RunCompare, ScoreBreakdown } from './DebriefSections'
import { decisionCounts, type DecisionCounts } from '../mission/proposal'
import { runKey, useTaskStats } from '../mission/crewTask'
import { MissionGraph } from './MissionGraph'
import { ProblemList } from '../mission/ProblemLog'
import { problemLog } from '../mission/problems'

/** Habitat station names for the mission log (the debrief has no habitat room loaded). */
const STATION_NAME: Record<string, string> = {
  power: 'Power & Life Support',
  comms: 'Comms station',
  science: 'Science bench',
  repair: 'Repair station',
  airlock: 'Airlock',
}

const OUTCOME = {
  success: { label: 'Success', text: 'text-success' },
  partial: { label: 'Partial', text: 'text-alert' },
  failed: { label: 'Failed', text: 'text-danger' },
} as const
const MAX_STARS = 3

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
    <PopupPanel onClose={onClose} section="Briefing" title="Mission debrief">
      <div className="p-6" data-testid="debrief" data-outcome={score.outcome}>
        <header className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b-2 border-border pb-4">
          <AssetImage
            kind="backgrounds"
            id={`outcome-${score.outcome}`}
            ext="png"
            label={outcome.label}
            className="h-[120px] w-[240px] shrink-0 border-2 border-border-strong"
          />
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
        <DecisionLine counts={decisionCounts(run, p.design, p.content)} />
        <TaskLine runKey={runKey(run)} />

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
            <section data-testid="debrief-mission-log">
              <h3 className={H3}>Mission Log</h3>
              <div className="mt-2 max-h-96 overflow-y-auto">
                <ProblemList
                  entries={problemLog(
                    run,
                    p.content.events,
                    (id) => p.content.crew.find((c) => c.id === id)?.name ?? id,
                  )}
                  stationLabel={(k) => STATION_NAME[k] ?? k}
                />
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

        <footer className="mt-6 flex flex-wrap items-center gap-3 border-t-2 border-border pt-4">
          <Button
            variant="secondary"
            onClick={() => setPhase('title')}
            data-testid="debrief-main-menu"
          >
            Main menu
          </Button>
          {confirmNew ? (
            <>
              <span className="text-sm text-alert">Start over? This plan is lost.</span>
              <Button variant="danger" onClick={newMission} data-testid="confirm-new-mission">
                Yes, new mission
              </Button>
              <Button variant="ghost" onClick={() => setConfirmNew(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setConfirmNew(true)}
              data-testid="new-mission"
            >
              New mission
            </Button>
          )}
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={newEvents}
              onChange={(e) => setNewEvents(e.target.checked)}
              className="size-4 accent-alert"
              data-testid="new-random-events"
            />
            New random events
          </label>
          <Button onClick={() => redesignAndRetry(newEvents)} data-testid="redesign-retry">
            Redesign &amp; retry
          </Button>
        </footer>
      </div>
    </PopupPanel>
  )
}

/** Who made the calls during the mission: you, your approvals of teammates, overrides, orders. */
function DecisionLine({ counts }: { counts: DecisionCounts }) {
  const items: Array<[string, number]> = [
    ['Decided by you', counts.decided],
    ['Teammate plans approved', counts.approved],
    ['Overridden by you', counts.overridden],
    ['Standing orders', counts.standingOrders],
  ]
  return (
    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1" data-testid="decision-counts">
      {items.map(([label, n]) => (
        <li key={label} className="flex items-baseline gap-2">
          <span className="label-caps text-sm text-muted">{label}</span>
          <span className="font-mono text-lg text-primary tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  )
}

/** "Hands-on tasks: X/Y completed" for this mission (counts kept per launch). */
function TaskLine({ runKey: key }: { runKey: string }) {
  const stats = useTaskStats((s) => s)
  const mine = stats.runKey === key
  return (
    <p className="mt-1 flex items-baseline gap-2" data-testid="task-counts">
      <span className="label-caps text-sm text-muted">Hands-on tasks</span>
      <span className="font-mono text-lg text-primary tabular-nums">
        {mine ? stats.completed : 0}/{mine ? stats.attempted : 0}
      </span>
      <span className="label-caps text-sm text-muted">completed</span>
    </p>
  )
}
