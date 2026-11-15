/**
 * Crew relationships and side missions during a mission run: trust per crew member, the active
 * side mission and its progress, completed ones, and next-day follow-ups. Morale changes go
 * through the engine (adjustCrewMorale); this store holds only what the engine does not.
 * Read with selectors: useCrewLife((s) => s.trust). Counts reset when a new mission launches.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getContent } from '@/content/load'
import { isEvaOption } from '@/engine/events'
import { adjustCrewMorale } from '@/engine/mission'
import { createRng } from '@/engine/rng'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { DialogueLine, SideMission } from '@/schemas'
import { useStore } from '@/store'
import type { Gauge } from './missionRun'

interface Active {
  id: string
  /** Turn index the mission started on. */
  startTurn: number
  /** Consecutive-turn progress (visit missions) or turns survived (avoid_eva). */
  progress: number
  /** Last turn index a visit counted on. */
  lastTurn: number
  /** decisions.length when it started (avoid_eva watches later decisions). */
  decisionsAtStart: number
}

export interface DoneMission {
  id: string
  day: number
}

interface CrewLifeState {
  /** Which mission these belong to (seed + first log line). */
  runKey: string
  trust: Record<string, number>
  active: Active | null
  done: DoneMission[]
  /** Crew id -> { text, turn } the member says on a later turn, once. */
  followUps: Record<string, { text: string; turn: number }>
  set: (patch: Partial<Omit<CrewLifeState, 'set'>>) => void
}

export const useCrewLife = create<CrewLifeState>()(
  persist(
    (set) => ({ runKey: '', trust: {}, active: null, done: [], followUps: {}, set: (p) => set(p) }),
    { name: 'mission-control-crewlife', storage: createJSONStorage(() => localStorage) },
  ),
)

/** Starts clean counts when a different mission is flying. */
export function ensureRun(run: MissionState): void {
  const key = `${run.seed}|${run.destinationId}|${run.eventLog[0]?.text ?? ''}`
  if (useCrewLife.getState().runKey === key) return
  useCrewLife.setState({ runKey: key, trust: {}, active: null, done: [], followUps: {} })
}

export function trustOf(crewId: string): number {
  return useCrewLife.getState().trust[crewId] ?? getContent().constants.dialogue.startTrust
}

function addTrust(crewId: string, delta: number): void {
  if (delta === 0) return
  const { trustMax } = getContent().constants.dialogue
  const next = Math.max(0, Math.min(trustMax, trustOf(crewId) + delta))
  useCrewLife.setState((s) => ({ trust: { ...s.trust, [crewId]: next } }))
}

export function sideMission(id: string): SideMission | undefined {
  return getContent().sideMissions.find((m) => m.id === id)
}

// ---- picking what a crew member says ------------------------------------------------------

export interface Pick {
  /** The line to show (a follow-up is a one-choice line built here). */
  line: DialogueLine
  followUp: boolean
}

function matches(
  l: DialogueLine,
  run: MissionState,
  gauges: readonly Gauge[],
  trust: number,
  recentEvents: readonly string[],
): boolean {
  const w = l.when
  const phase = run.phaseId
  const morale = run.crew[l.crewId]?.morale ?? 100
  return (
    (w.minDay === undefined || run.day >= w.minDay) &&
    (w.maxDay === undefined || run.day <= w.maxDay) &&
    (w.destination === undefined || w.destination === run.destinationId) &&
    (w.phase === undefined || w.phase === phase) &&
    (w.lowResource === undefined ||
      gauges.some((g) => g.id === w.lowResource && g.status !== 'ok')) &&
    (w.moraleBelow === undefined || morale < w.moraleBelow) &&
    (w.recentEvent === undefined || recentEvents.includes(w.recentEvent)) &&
    (w.minTrust === undefined || trust >= w.minTrust) &&
    (w.maxTrust === undefined || trust <= w.maxTrust)
  )
}

/**
 * What this crew member says now. Priority: a follow-up to a finished side mission (from the
 * next turn), then a reaction to a recent event, then a low-resource reaction, then an everyday
 * line chosen with the seeded generator (so it changes every turn, the same way for the same seed).
 */
export function pickLine(
  crewId: string,
  run: MissionState,
  gauges: readonly Gauge[],
  content: EngineContent,
): Pick | null {
  const trust = trustOf(crewId)
  const follow = useCrewLife.getState().followUps[crewId]
  if (follow && run.turnIndex > follow.turn) {
    const line: DialogueLine = {
      id: `${crewId}-followup`,
      crewId,
      kind: 'normal',
      text: follow.text,
      when: {},
      fact: false,
      choices: [{ text: 'Glad to help.', reply: 'You really are.', trust: 1, morale: 2 }],
    }
    return { line, followUp: true }
  }
  const window = content.constants.dialogue.recentTurns
  const recent = run.turnHistory.slice(-window).flatMap((t) => t.eventIds)
  const mine = getContent().dialogue.filter(
    (l) => l.crewId === crewId && matches(l, run, gauges, trust, recent),
  )
  // A side mission already running or done is not offered again.
  const { active, done } = useCrewLife.getState()
  const usable = mine.filter((l) =>
    l.choices.every(
      (c) => !c.startSideMission || (!active && !done.some((d) => d.id === c.startSideMission)),
    ),
  )
  const pool = usable.length ? usable : mine
  const pick = (kind: DialogueLine['kind']) => pool.filter((l) => l.kind === kind)
  const best = [pick('event'), pick('resource'), pick('normal')].find((g) => g.length > 0)
  if (!best) return null
  const rng = createRng(run.seed + run.turnIndex * 31 + crewId.length * 7 + crewId.charCodeAt(0))
  return { line: best[rng.int(0, best.length - 1)]!, followUp: false }
}

/** Applies a chosen reply: trust (store), morale (engine), and starting a side mission. */
export function applyChoice(line: DialogueLine, index: number): void {
  const choice = line.choices[index]
  if (!choice) return
  addTrust(line.crewId, choice.trust)
  const run = useStore.getState().mission.run
  if (run && choice.morale !== 0)
    useStore.getState().setRun(adjustCrewMorale(run, line.crewId, choice.morale, `talk:${line.id}`))
  const m = choice.startSideMission
  if (m && run && !useCrewLife.getState().active)
    useCrewLife.setState({
      active: {
        id: m,
        startTurn: run.turnIndex,
        progress: 0,
        lastTurn: -1,
        decisionsAtStart: run.decisions.length,
      },
    })
  if (line.id.endsWith('-followup')) {
    useCrewLife.setState((s) => {
      const { [line.crewId]: _gone, ...rest } = s.followUps
      void _gone
      return { followUps: rest }
    })
  }
}

// ---- tracking side missions ----------------------------------------------------------------

function complete(m: SideMission, run: MissionState): void {
  useCrewLife.setState((s) => ({
    active: null,
    done: [...s.done, { id: m.id, day: run.day }],
    followUps: { ...s.followUps, [m.crewId]: { text: m.followUp, turn: run.turnIndex } },
  }))
  addTrust(m.crewId, m.rewardTrust)
  const now = useStore.getState().mission.run ?? run
  if (m.rewardMorale !== 0)
    useStore
      .getState()
      .setRun(adjustCrewMorale(now, m.crewId, m.rewardMorale, `sidemission:${m.id}`))
}

/** The player used a station: counts for a "visit" side mission. Returns true if it finished. */
export function noteStationVisit(station: string, run: MissionState): boolean {
  const a = useCrewLife.getState().active
  const m = a && sideMission(a.id)
  if (!a || !m || m.kind !== 'visit_station' || m.station !== station) return false
  if (m.calmOnly && run.pendingEvents.length > 0) return false
  if (run.turnIndex === a.lastTurn) return false
  const progress = run.turnIndex === a.lastTurn + 1 ? a.progress + 1 : 1
  if (progress >= m.turns) {
    complete(m, run)
    return true
  }
  useCrewLife.setState({ active: { ...a, progress, lastTurn: run.turnIndex } })
  return false
}

/** After a turn: "avoid EVA" missions count turns survived, and fail if the member went out. */
export function noteTurn(run: MissionState, design: Design, content: EngineContent): void {
  void design
  const a = useCrewLife.getState().active
  const m = a && sideMission(a.id)
  if (!a || !m || m.kind !== 'avoid_eva') return
  const wentOut = run.decisions.slice(a.decisionsAtStart).some((d) => {
    const option = content.events
      .find((e) => e.id === d.eventId)
      ?.options.find((o) => o.id === d.optionId)
    return d.crewId === m.crewId && option !== undefined && isEvaOption(option)
  })
  if (wentOut) {
    useCrewLife.setState({ active: null })
    return
  }
  const progress = run.turnIndex - a.startTurn
  if (progress >= m.turns) complete(m, run)
  else useCrewLife.setState({ active: { ...a, progress } })
}
