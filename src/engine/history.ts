/**
 * Recording helpers: every resource change becomes a ChangeRecord and every turn a compact
 * TurnSnapshot, so the debrief can explain what happened. Pure TypeScript (CLAUDE.md rule 1).
 */
import type { ChangeSource, MissionState, TurnSnapshot } from './types'

/** Appends a change if it is not zero (mutates the draft). */
export function recordChange(
  s: MissionState,
  resource: string,
  delta: number,
  sourceType: ChangeSource,
  sourceId: string,
  note: string,
): void {
  if (delta === 0 || !Number.isFinite(delta)) return
  s.changes.push({ turn: s.turnIndex, day: s.day, resource, delta, sourceType, sourceId, note })
}

export interface TurnFlags {
  dataLostGb: number
  batteryEmpty: boolean
  scienceShed: boolean
  lifeSupportDegraded: boolean
  rationing: boolean
}

/** Appends the end-of-turn snapshot (mutates the draft). */
export function recordSnapshot(
  s: MissionState,
  turn: {
    turnIndex: number
    startDay: number
    days: number
    phaseId: string
    location: TurnSnapshot['location']
  },
  eventIds: string[],
  flags: TurnFlags,
): void {
  const round = (n: number) => Math.round(n * 1000) / 1000
  s.turnHistory.push({
    turn: turn.turnIndex,
    day: turn.startDay,
    days: turn.days,
    phaseId: turn.phaseId,
    location: turn.location,
    resources: Object.fromEntries(Object.entries(s.resources).map(([k, v]) => [k, round(v)])),
    crew: Object.fromEntries(
      Object.entries(s.crew).map(([id, c]) => [
        id,
        [round(c.energy), round(c.morale), round(c.health)],
      ]),
    ),
    eventIds,
    disabledParts: Object.keys(s.disabledParts),
    ...flags,
  })
}
