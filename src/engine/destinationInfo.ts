/**
 * Display facts for a destination card, derived from content (no maths in components).
 * Pure TypeScript (CLAUDE.md rule 1).
 */
import type { Destination } from '@/schemas'
import { fmt } from './format'
import { totalMissionDays } from './timeline'

export interface DestinationSummary {
  transit: string
  signalDelay: string
  sunlight: string
  gravity: string
  resupply: string
  missionLength: string
  missionDays: number
}

const DAYS_PER_YEAR = 365

function seconds(sec: number): string {
  return sec < 60 ? `${fmt(sec, 1)} s` : `${fmt(sec / 60)} min`
}

export function destinationSummary(d: Destination): DestinationSummary {
  const [min, max] = d.signalDelayRangeSec
  const days = totalMissionDays(d)
  const sameUnit = min < 60 === max < 60
  return {
    transit: `${fmt(d.transitDays)} days`,
    // Short delays show the range in seconds; long ones in minutes ("3–22 min").
    signalDelay:
      min === max
        ? seconds(min)
        : sameUnit && max >= 60
          ? `${fmt(min / 60)}–${fmt(max / 60)} min`
          : sameUnit
            ? `${fmt(min, 2)}–${fmt(max, 2)} s`
            : `${seconds(min)}–${seconds(max)}`,
    sunlight: `${fmt(d.sunlightFactor * d.lightFraction * 100)}%`,
    gravity: `${fmt(d.gravityG, 2)} g`,
    resupply: d.resupplyPossible ? 'Yes' : 'No',
    missionLength:
      days < DAYS_PER_YEAR ? `${fmt(days)} days` : `~${fmt(days / DAYS_PER_YEAR)} years`,
    missionDays: days,
  }
}
