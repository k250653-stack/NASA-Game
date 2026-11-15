/**
 * What each habitat station shows, read from the mission state (no engine changes): data and
 * comms, science, systems, airlock, plus which stations need attention ("!" in the room) and a
 * short in-character line from the crew member posted there. No React.
 */
import { isEvaOption } from '@/engine/events'
import { computeScore, type BonusResult } from '@/engine/score'
import type { Design, EngineContent, LogEntry, MissionState } from '@/engine/types'
import { computeTotals } from '@/engine/budget'
import type { CrewMember, ModifierKey, Part } from '@/schemas'
import type { WorkstationKind } from '../rooms/room'
import { LOW_SHARE, ROLE_POST, type Gauge } from './missionRun'

/** Storage counts as "nearly full" from this share of capacity. */
const STORAGE_WARN_SHARE = 0.9
const MESSAGE_COUNT = 5

export interface CommsInfo {
  collectedGb: number
  sentGb: number
  backlogGb: number
  lostGb: number
  storageGb: number
  storageFull: boolean
  returnGbPerDay: number
  contactHours: number
  messages: LogEntry[]
}

export function commsInfo(
  s: MissionState,
  design: Design,
  content: EngineContent,
  contactHours: number,
): CommsInfo {
  const lostGb = s.changes
    .filter((c) => c.resource === 'dataLostGb')
    .reduce((a, c) => a + c.delta, 0)
  const storageGb = content.constants.mission.dataStorageGb
  const r = s.resources
  return {
    collectedGb: r.scienceGb + r.dataBacklogGb + lostGb,
    sentGb: r.scienceGb,
    backlogGb: r.dataBacklogGb,
    lostGb,
    storageGb,
    storageFull: r.dataBacklogGb >= storageGb * STORAGE_WARN_SHARE,
    returnGbPerDay: computeTotals(design, content).dataReturnGbPerDay,
    contactHours,
    messages: s.eventLog
      .filter((l) => l.kind !== 'science')
      .slice(-MESSAGE_COUNT)
      .reverse(),
  }
}

export interface PartLine {
  part: Part
  count: number
  status: 'ok' | 'disabled' | 'idle' | 'paused'
  note: string
}

const isScience = (p: Part) => p.category === 'instrument' || p.category === 'rover'

/** Every installed part (grouped), with whether it works this turn and why not. */
export function partLines(s: MissionState, design: Design, content: EngineContent): PartLine[] {
  const counts = new Map<string, number>()
  design.partIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1))
  const shed = s.turnHistory[s.turnHistory.length - 1]?.scienceShed ?? false
  return [...counts].flatMap(([id, count]) => {
    const part = content.parts.find((p) => p.id === id)
    if (!part) return []
    const off = s.disabledParts[id]
    const line: PartLine =
      off !== undefined
        ? {
            part,
            count,
            status: 'disabled',
            note: `Offline, back in ${off} turn${off === 1 ? '' : 's'}`,
          }
        : isScience(part) && shed
          ? { part, count, status: 'paused', note: 'Paused: power shortage' }
          : part.location === 'surface' && s.location !== 'surface'
            ? { part, count, status: 'idle', note: 'Idle until the surface' }
            : { part, count, status: 'ok', note: 'Working' }
    return [line]
  })
}

export const scienceParts = (lines: readonly PartLine[]) => lines.filter((l) => isScience(l.part))

export function bonusStatus(
  s: MissionState,
  design: Design,
  content: EngineContent,
  trades: number,
): BonusResult[] {
  return computeScore(s, design, content, { tradesCount: trades }).bonusObjectives
}

const MODIFIER_LABEL: Record<ModifierKey, string> = {
  solarOutput: 'Solar output',
  powerUse: 'Power use',
  dataRate: 'Data rate',
  scienceRate: 'Science rate',
  lifeSupportUse: 'Life support use',
}

/** "Solar output −30% for 2 turns (Dust Storm)" */
export function effectLines(s: MissionState, content: EngineContent): string[] {
  return s.activeEffects.map((e) => {
    const pct = Math.round((e.value - 1) * 100)
    const title = content.events.find((ev) => ev.id === e.sourceEventId)?.title
    return `${MODIFIER_LABEL[e.target]} ${pct >= 0 ? '+' : '−'}${Math.abs(pct)}% for ${e.turnsLeft} turn${e.turnsLeft === 1 ? '' : 's'}${title ? ` (${title})` : ''}`
  })
}

export interface EvaLine {
  day: number
  who: string
  what: string
  success: boolean
}

/** Spacewalks so far: every decision that used an EVA option. */
export function evaLines(s: MissionState, content: EngineContent): EvaLine[] {
  return s.decisions.flatMap((d) => {
    const event = content.events.find((e) => e.id === d.eventId)
    const option = event?.options.find((o) => o.id === d.optionId)
    if (!event || !option || !isEvaOption(option)) return []
    const who = content.crew.find((c) => c.id === d.crewId)?.name ?? 'The crew'
    return [{ day: d.day, who, what: option.label, success: d.success }]
  })
}

/** Crew who could suit up right now: healthy and not busy. */
export function evaReady(
  s: MissionState,
  crew: readonly CrewMember[],
): Array<{ member: CrewMember; energy: number }> {
  return crew.flatMap((m) => {
    const c = s.crew[m.id]
    return c && c.health > 0 && c.busyTurns === 0
      ? [{ member: m, energy: Math.round(c.energy) }]
      : []
  })
}

/** Stations that need a look: storage nearly full, parts offline, suits gone, supplies low. */
export function attention(
  s: MissionState,
  design: Design,
  content: EngineContent,
  gauges: readonly Gauge[],
): WorkstationKind[] {
  const out: WorkstationKind[] = []
  if (s.resources.dataBacklogGb >= content.constants.mission.dataStorageGb * STORAGE_WARN_SHARE)
    out.push('comms')
  const disabled = design.partIds.filter((id) => s.disabledParts[id] !== undefined)
  if (disabled.some((id) => isScience(content.parts.find((p) => p.id === id) ?? ({} as Part))))
    out.push('science')
  if (disabled.length > 0) out.push('repair')
  if (s.resources.suits < 1) out.push('airlock')
  if (
    gauges.some(
      (g) => g.id !== 'science' && g.id !== 'suits' && g.id !== 'spares' && g.status !== 'ok',
    )
  )
    out.push('power')
  return out
}

/** The crew member posted at a station (the most rested one for the airlock). */
export function crewAt(
  kind: WorkstationKind,
  team: readonly CrewMember[],
  s: MissionState,
): CrewMember | undefined {
  if (kind === 'airlock')
    return [...team].sort((a, b) => (s.crew[b.id]?.energy ?? 0) - (s.crew[a.id]?.energy ?? 0))[0]
  return team.find((m) => ROLE_POST[m.role] === kind)
}

/** One short line from that crew member, worried when their station is in trouble. */
export function stationComment(
  kind: WorkstationKind,
  worried: boolean,
  s: MissionState,
  crewId: string,
): string {
  const tired = (s.crew[crewId]?.energy ?? 100) < 100 * LOW_SHARE
  if (tired) return "I'm running on fumes. Give me a quiet turn and I'll be sharper."
  const lines: Record<WorkstationKind, [string, string]> = {
    comms: [
      'Link is clean. Everything we collect is making it home.',
      "The buffer is filling faster than we can send. We're going to lose data.",
    ],
    science: [
      'Instruments are humming. This is why we came.',
      "Half my kit is down. Every quiet day is science we don't get back.",
    ],
    repair: [
      'All systems nominal. I like boring days.',
      "Something's offline and the spares won't last forever.",
    ],
    airlock: [
      'Suits are checked and ready if we need to go out.',
      "We're short on suits. Any spacewalk now is a real risk.",
    ],
    power: [
      'Power and air are steady. Breathe easy.',
      "Reserves are dropping. I'd rather fix it now than at night.",
    ],
  }
  return lines[kind][worried ? 1 : 0]
}
