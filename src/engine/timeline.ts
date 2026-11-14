/**
 * Mission timeline: long missions are compressed into phases with different turn lengths
 * (Mars cruise in 30-day turns, surface in 15-day turns). Also signal delay over time and
 * what the design produces in each turn. Pure TypeScript (CLAUDE.md rule 1).
 */
import type { Destination, Location, Part, PartStatKey } from '@/schemas'
import { resolveDesign } from './budget'
import { dataReturnedGbPerDay } from './physics'
import type { Design, EngineContent } from './types'

export interface Turn {
  /** 0-based across the whole mission. */
  turnIndex: number
  phaseId: string
  /** Mission day this turn starts on (day 0 = launch). */
  startDay: number
  /** Length of this turn; the last turn of a phase may be shorter than turnDays. */
  days: number
  location: Location
  eventsTag: string
}

/** Sum of all phase days. */
export function totalMissionDays(destination: Destination): number {
  return destination.phases.reduce((sum, p) => sum + p.days, 0)
}

/**
 * Splits every phase into turns of turnDays; the remainder becomes a shorter final turn.
 * Turns per phase = ceil(days ÷ turnDays). Example: 220-day return at 30 days/turn
 * = 7 full turns + one 10-day turn = 8 turns.
 */
export function missionTimeline(destination: Destination): Turn[] {
  const turns: Turn[] = []
  let day = 0
  for (const phase of destination.phases) {
    let remaining = phase.days
    while (remaining > 0) {
      const days = Math.min(phase.turnDays, remaining)
      turns.push({
        turnIndex: turns.length,
        phaseId: phase.id,
        startDay: day,
        days,
        location: phase.location,
        eventsTag: phase.eventsTag,
      })
      day += days
      remaining -= days
    }
  }
  return turns
}

/**
 * One-way signal delay on a mission day, in seconds. Smoothly swings between the closest and
 * farthest values over the mission with a half cosine:
 * delay = min + (max − min) × (1 − cos(2π × day ÷ missionDays)) ÷ 2.
 * Starts at min, peaks at max mid-mission, returns to min at the end.
 */
export function signalDelay(destination: Destination, day: number): number {
  const [min, max] = destination.signalDelayRangeSec
  const total = totalMissionDays(destination)
  if (total <= 0 || max === min) return min
  const t = Math.min(Math.max(day, 0), total) / total
  return min + ((max - min) * (1 - Math.cos(2 * Math.PI * t))) / 2
}

/** Does a part work at this location? "surface" parts do nothing in transit. */
export function partWorksAt(part: Part, location: Location): boolean {
  return part.location === 'any' || location === 'surface'
}

export interface TurnOutput {
  sciencePoints: number
  dataGenGb: number
  dataReturnGb: number
}

/**
 * What the design produces in one turn.
 * - science and data: only from parts that work at the turn's location, × turn days
 * - data returned: link rate over contactHoursPerDay on the surface, or
 *   transitContactHoursPerDay in transit, × turn days (capped at data generated)
 */
export function turnOutput(design: Design, content: EngineContent, turn: Turn): TurnOutput {
  const { destination, parts } = resolveDesign(design, content)
  const active = parts.filter((p) => partWorksAt(p, turn.location))
  const sum = (list: readonly Part[], key: PartStatKey) =>
    list.reduce((acc, p) => acc + (p.stats[key] ?? 0), 0)
  const hours =
    turn.location === 'surface'
      ? destination.contactHoursPerDay
      : destination.transitContactHoursPerDay
  const dataGenGb = sum(active, 'scienceDataGbPerDay') * turn.days
  const capacityGb = dataReturnedGbPerDay(sum(active, 'dataRateMbps'), hours) * turn.days
  return {
    sciencePoints: sum(active, 'sciencePointsPerDay') * turn.days,
    dataGenGb,
    dataReturnGb: Math.min(dataGenGb, capacityGb),
  }
}
