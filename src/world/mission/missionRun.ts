/**
 * Glue between the engine's mission loop and the habitat: seeded randomness per step, which
 * workstation an action happens at, and what the HUD shows. No React, no Phaser.
 */
import { isEvaOption } from '@/engine/events'
import { batteryCapacityWh } from '@/engine/missionHelpers'
import { createRng, type Rng } from '@/engine/rng'
import { missionTimeline, signalDelay, totalMissionDays } from '@/engine/timeline'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import { computeTotals } from '@/engine/budget'
import type { Destination, GameEvent, Role } from '@/schemas'
import type { WorkstationKind } from '../rooms/room'

/** Each role's post in the habitat. */
export const ROLE_POST: Record<Role, WorkstationKind> = {
  power_life: 'power',
  comms_nav: 'comms',
  science: 'science',
  launch_budget: 'repair',
}

/** Theme colour token per role (index.css). */
export const ROLE_TOKEN: Record<Role, string> = {
  science: 'role-science',
  power_life: 'role-power',
  comms_nav: 'role-comms',
  launch_budget: 'role-budget',
}

/** HUD bar thresholds: share of the starting amount (or of the target for science). */
export const LOW_SHARE = 0.35
export const CRITICAL_SHARE = 0.15

/**
 * The engine keeps no random state between calls, so every step gets a generator derived from
 * the run's seed and how far it has got. A reloaded save continues with the same sequence.
 */
export function rngFor(s: MissionState): Rng {
  return createRng(
    s.seed + s.turnIndex * 7919 + s.decisions.length * 104_729 + s.eventLog.length * 13,
  )
}

/** Where an action happens: the airlock for EVAs, otherwise the event role's workstation. */
export function actionPost(event: GameEvent, optionId: string): WorkstationKind {
  const option = event.options.find((o) => o.id === optionId)
  return option && isEvaOption(option) ? 'airlock' : ROLE_POST[event.role]
}

export interface DayInfo {
  day: number
  totalDays: number
  phaseName: string
  /** One-way signal delay in minutes, or null where the crew talks to Earth live. */
  delayMin: number | null
}

export function dayInfo(s: MissionState, dest: Destination, content: EngineContent): DayInfo {
  const live = content.constants.settings.liveResponseDestinations.includes(dest.id)
  const phase = dest.phases.find((p) => p.id === s.phaseId)
  return {
    day: s.day,
    totalDays: totalMissionDays(dest),
    phaseName: phase?.name ?? s.phaseId,
    delayMin: live ? null : signalDelay(dest, s.day) / 60,
  }
}

export interface Gauge {
  id: string
  label: string
  icon: string
  /** 0-1 fill. */
  share: number
  value: string
  status: 'ok' | 'low' | 'critical'
}

const fmt = (n: number, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits })

function gauge(
  id: string,
  label: string,
  icon: string,
  now: number,
  full: number,
  value: string,
): Gauge {
  const share = full > 0 ? Math.max(0, Math.min(1, now / full)) : 0
  const status = share <= CRITICAL_SHARE ? 'critical' : share <= LOW_SHARE ? 'low' : 'ok'
  return { id, label, icon, share, value, status }
}

/** The eight HUD bars. Supplies compare with what was packed; power with what the base uses. */
export function gauges(
  s: MissionState,
  design: Design,
  content: EngineContent,
  scienceTarget: number,
): Gauge[] {
  const ctx = { design, content }
  const t = computeTotals(design, content)
  const r = s.resources
  const cap = batteryCapacityWh(s, ctx)
  const { genW, useW } = s.lastPower
  return [
    gauge(
      'power',
      'Power',
      'IconBolt',
      genW,
      Math.max(useW, 1),
      `${fmt(genW)} W made / ${fmt(useW)} W used`,
    ),
    gauge(
      'battery',
      'Battery',
      'IconBattery4',
      r.batteryWh,
      cap,
      `${fmt(r.batteryWh)} / ${fmt(cap)} Wh`,
    ),
    gauge(
      'water',
      'Water',
      'IconDroplet',
      r.waterKg,
      design.supplies.waterKg,
      `${fmt(r.waterKg)} / ${fmt(design.supplies.waterKg)} kg`,
    ),
    gauge(
      'food',
      'Food',
      'IconPackage',
      r.foodKg,
      design.supplies.foodKg,
      `${fmt(r.foodKg)} / ${fmt(design.supplies.foodKg)} kg`,
    ),
    gauge(
      'oxygen',
      'Oxygen',
      'IconLungs',
      r.oxygenKg,
      design.supplies.oxygenKg,
      `${fmt(r.oxygenKg)} / ${fmt(design.supplies.oxygenKg)} kg`,
    ),
    gauge(
      'suits',
      'Suits',
      'IconShirt',
      r.suits,
      t.suitCount,
      `${r.suits} of ${t.suitCount} working`,
    ),
    gauge(
      'spares',
      'Spares',
      'IconTool',
      r.spareKits,
      t.spareKits,
      `${r.spareKits} of ${t.spareKits} kits`,
    ),
    {
      ...gauge(
        'science',
        'Science',
        'IconFlask',
        r.sciencePoints,
        scienceTarget,
        `${fmt(r.sciencePoints)} / ${fmt(scienceTarget)} points`,
      ),
      status: 'ok',
    },
  ]
}

/** Daily use of the consumables over the turns so far, for the resources popup. */
export function dailyUse(
  s: MissionState,
  design: Design,
  key: 'waterKg' | 'foodKg' | 'oxygenKg',
): number {
  if (s.day <= 0) return 0
  return Math.max(0, (design.supplies[key] - s.resources[key]) / s.day)
}

export { missionTimeline }
