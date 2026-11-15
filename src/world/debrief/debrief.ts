/**
 * Debrief glue: recording a finished run, the return to the HQ Briefing room, crew positions
 * around the meeting table, the mission graph series and crew reaction lines. No React.
 */
import type { RunComparison } from '@/engine/compareRuns'
import { computeScore } from '@/engine/score'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { CrewMember } from '@/schemas'
import { createRng } from '@/engine/rng'
import { resetAll, useStore } from '@/store'
import { useUi } from '@/ui/uiStore'
import { useRunHistory } from '@/store/runHistory'
import { facingFrom } from '../character'
import type { Point } from '../geometry'
import type { HqCrew } from '../HQScene'
import { getHqMap } from '../hqMap'
import { ROLE_TOKEN } from '../mission/missionRun'
import { savePlayerPos, useWorld } from '../worldStore'

/** New random events: seeds stay in the range the scenario screen uses. */
const SEED_MAX = 999_999_999
/** Score bar colours: at or above GOOD is cyan, at or above POOR amber, below red. */
const GOOD_SCORE = 70
const POOR_SCORE = 40

/** Set when a mission ends; the HQ opens the debrief shortly after it appears. */
let debriefCue = false
export const hasDebriefCue = (): boolean => debriefCue
export function clearDebriefCue(): void {
  debriefCue = false
}

/** Mission over: save the run to the history, then go to the Briefing room door. */
export function returnToEarth(run: MissionState, design: Design, content: EngineContent): void {
  const { design: stored, setPhase } = useStore.getState()
  const score = computeScore(run, design, content, { tradesCount: stored.tradesAccepted })
  useRunHistory.getState().addRun({
    id: `${run.seed}|${stored.signature}|${run.day}|${run.decisions.length}|${run.eventLog.length}`,
    scenarioId: design.scenarioId,
    destinationId: design.destinationId,
    seed: run.seed,
    design,
    score,
    outcome: score.outcome,
    days: run.day,
  })
  // Back in the Briefing room, next to the meeting table (hq-map.json "briefingArrival").
  savePlayerPos(getHqMap().briefingArrival)
  debriefCue = true
  setPhase('hq')
}

/** The recruited crew (not the player) standing around the meeting table, in world pixels. */
export function crewAtTable(team: readonly CrewMember[]): HqCrew[] {
  const { tableSpots, tableCenter } = getHqMap()
  return team
    .filter((m) => !m.isPlayer)
    .slice(0, tableSpots.length)
    .map((m, i) => {
      const [x, y] = tableSpots[i]!
      return {
        at: [x, y] as Point,
        color: ROLE_TOKEN[m.role],
        facing: facingFrom(tableCenter[0] - x, tableCenter[1] - y),
      }
    })
}

export interface Series {
  id: string
  label: string
  /** Theme colour token. */
  color: string
  /** [day, 0-1 of the series' own maximum] */
  points: Array<[number, number]>
  max: number
  unit: string
}

const SERIES = [
  { id: 'batteryWh', label: 'Power (battery)', color: 'alert', unit: 'Wh' },
  { id: 'waterKg', label: 'Water', color: 'accent', unit: 'kg' },
  { id: 'oxygenKg', label: 'Oxygen', color: 'success', unit: 'kg' },
  { id: 'sciencePoints', label: 'Science', color: 'role-science', unit: 'pts' },
] as const

/** Key resources at the end of every turn, each scaled to its own peak. */
export function graphSeries(run: MissionState): Series[] {
  return SERIES.map((s) => {
    const raw = run.turnHistory.map(
      (t) => [t.day + t.days, t.resources[s.id] ?? 0] as [number, number],
    )
    const max = Math.max(1, ...raw.map(([, v]) => v))
    return { ...s, max, points: raw.map(([d, v]) => [d, v / max]) }
  })
}

/** One short line per crew member, from the outcome and how they feel. */
export function reactionLine(
  outcome: 'success' | 'partial' | 'failed',
  morale: number,
  health: number,
): string {
  if (health <= 0) return 'Did not make it home.'
  const happy = morale >= 60
  if (outcome === 'success')
    return happy
      ? 'We did it. I would fly with this crew again.'
      : 'We made it, but I am running on empty.'
  if (outcome === 'partial')
    return happy
      ? 'Not everything worked, but we learned a lot.'
      : 'We cut it too close. Next time, more margin.'
  return happy
    ? 'We failed, but we know why. Let us fix it.'
    : 'That plan let us down. It has to change.'
}

/**
 * Redesign & retry: same destination, scenario, role, crew and design. The Briefing room's
 * planning board unlocks again (Launch Control waits for the plan). Same seed unless asked.
 */
export function redesignAndRetry(newRandomEvents: boolean): void {
  const s = useStore.getState()
  if (newRandomEvents) {
    const seed = createRng(s.game.seed + useRunHistory.getState().runs.length).int(1, SEED_MAX)
    s.setSeed(seed)
    // The plan is keyed by the seed; carry it over so the AI does not propose a fresh design.
    useStore.setState((st) => ({
      design: {
        ...st.design,
        signature: st.design.signature?.replace(/\|[^|]*$/, `|${seed}`) ?? null,
      },
    }))
  }
  s.setRun(null)
  useWorld.setState({ planningDone: false })
  s.setPhase('hq')
}

/** New mission: a fresh game in the HQ lobby (the run history is kept). */
export function newMission(): void {
  resetAll()
  useWorld.getState().resetWorld()
  useUi.getState().setSandboxStart(false)
  useStore.getState().setPhase('hq')
}

/** Score bar colour: the same three tones as the HUD. */
export function scoreTone(v: number): 'bg-accent' | 'bg-alert' | 'bg-danger' {
  return v >= GOOD_SCORE ? 'bg-accent' : v >= POOR_SCORE ? 'bg-alert' : 'bg-danger'
}

/** Design changes as short lines: "Launcher: Medium Lunar Launcher → Heavy Launcher", "Water +6 days". */
export function changeLines(cmp: RunComparison, design: Design, content: EngineContent): string[] {
  const perDay = content.constants.perCrewPerDay
  const crew = Math.max(1, design.crewIds.length)
  return cmp.designChanges.map((c) => {
    const key = c.field.startsWith('supplies.')
      ? (c.field.slice(9) as 'waterKg' | 'foodKg' | 'oxygenKg')
      : null
    if (key) {
      const days = (Number(c.after) - Number(c.before)) / (crew * perDay[key])
      const name = key.replace('Kg', '')
      return `${name[0]!.toUpperCase()}${name.slice(1)} ${days >= 0 ? '+' : ''}${days.toFixed(Math.abs(days) < 10 ? 1 : 0)} days`
    }
    return `${c.label}: ${c.before} → ${c.after}`
  })
}
