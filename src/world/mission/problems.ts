/**
 * Pending problems and the problems log. The log is rebuilt from the mission state (which is
 * saved with the game), so it needs no store of its own. UI state (popup dismissed, which problem
 * to show, log open) lives in a small store. Read with selectors: useProblems((s) => s.logOpen).
 */
import { create } from 'zustand'
import { isEvaOption } from '@/engine/events'
import type { MissionState } from '@/engine/types'
import type { GameEvent } from '@/schemas'
import { ROLE_POST } from './missionRun'

interface ProblemsState {
  /** The event popup was closed (Esc / ×): the problem stays pending, shown by the "!" button. */
  dismissed: boolean
  /** Pending problem to show first (clicked in the log), else the oldest. */
  focusUid: string | null
  logOpen: boolean
  set: (patch: Partial<Omit<ProblemsState, 'set'>>) => void
}

export const useProblems = create<ProblemsState>()((set) => ({
  dismissed: false,
  focusUid: null,
  logOpen: false,
  set: (patch) => set(patch),
}))

/** Reopens the event popup (the "!" button, Q, or a pending log entry). */
export function reopenProblem(uid?: string): void {
  useProblems.setState({ dismissed: false, focusUid: uid ?? null, logOpen: false })
}

export type ProblemStatus = 'pending' | 'resolved' | 'failed'
export type HandledBy =
  'You' | 'Teammate' | 'Approved' | 'Standing order' | 'Auto at next turn' | 'Nobody'

export interface ProblemEntry {
  uid: string
  event: GameEvent
  day: number
  /** Station kind where it happened (habitat), e.g. "power", "airlock". */
  station: string
  status: ProblemStatus
  handledBy: HandledBy | null
  option: string | null
  crewName: string | null
  /** "batteryWh −1,200", "suits −1", ... */
  changes: string[]
}

function whoFromLog(text: string): HandledBy {
  if (text.startsWith('Not handled by you'))
    return text.includes('nobody') ? 'Nobody' : 'Auto at next turn'
  if (text.startsWith('You')) return 'You'
  if (text.includes('(approved by you)')) return 'Approved'
  if (text.startsWith('Handled by crew')) return 'Standing order'
  return 'Teammate'
}

const fmtDelta = (v: number) =>
  `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}`

/** One entry per problem that fired, oldest first. */
export function problemLog(
  run: MissionState,
  events: readonly GameEvent[],
  crewName: (id: string) => string,
): ProblemEntry[] {
  const out: ProblemEntry[] = []
  const usedDecisions = new Set<number>()
  const usedLines = new Set<number>()
  run.eventLog.forEach((line, i) => {
    if (line.kind !== 'event' || !line.eventId) return
    const event = events.find((e) => e.id === line.eventId)
    if (!event) return
    const firedTurn = line.turnIndex ?? 0
    const uid = `${event.id}@${firedTurn}`
    const pending = run.pendingEvents.some((p) => p.uid === uid)
    // The answer is the next decision for this event at or after the turn it fired.
    const di = run.decisions.findIndex(
      (d, k) => !usedDecisions.has(k) && d.eventId === event.id && d.turn >= firedTurn,
    )
    const answer = !pending && di >= 0 ? run.decisions[di] : undefined
    if (answer) usedDecisions.add(di)
    const li = run.eventLog.findIndex(
      (l, k) =>
        k > i &&
        !usedLines.has(k) &&
        l.eventId === event.id &&
        (l.kind === 'decision' || l.kind === 'warning'),
    )
    const outcome = !pending && li >= 0 ? run.eventLog[li] : undefined
    if (outcome) usedLines.add(li)
    const option = answer ? event.options.find((o) => o.id === answer.optionId) : undefined
    const changes = answer
      ? run.changes
          .filter(
            (c) =>
              (c.sourceId === event.id || c.sourceId === `${event.id}:${answer.optionId}`) &&
              c.turn >= firedTurn &&
              c.turn <= answer.turn,
          )
          .map((c) => `${c.resource} ${fmtDelta(c.delta)}`)
      : []
    out.push({
      uid,
      event,
      day: line.day,
      station: option && isEvaOption(option) ? 'airlock' : ROLE_POST[event.role],
      status: pending ? 'pending' : answer ? (answer.success ? 'resolved' : 'failed') : 'failed',
      handledBy: pending ? null : outcome ? whoFromLog(outcome.text) : null,
      option: option?.label ?? null,
      crewName: answer?.crewId ? crewName(answer.crewId) : null,
      changes,
    })
  })
  return out
}
