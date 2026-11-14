/**
 * Small read-only helpers shared by the mission loop, events and crew AI.
 * Pure TypeScript (CLAUDE.md rule 1).
 */
import type { CrewMember, ModifierKey, Part, PartStatKey } from '@/schemas'
import { analyzeTeam, type TeamModifiers } from './teamBalance'
import type { MissionContext, MissionState } from './types'

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Deep copy so public functions never mutate their input. */
export function cloneState(s: MissionState): MissionState {
  return structuredClone(s)
}

/** Design parts (repeats kept) that are not currently disabled. */
export function activeParts(s: MissionState, ctx: MissionContext): Part[] {
  return ctx.design.partIds
    .filter((id) => !(s.disabledParts[id] && s.disabledParts[id] > 0))
    .map((id) => ctx.content.parts.find((p) => p.id === id))
    .filter((p): p is Part => p !== undefined)
}

export function designParts(ctx: MissionContext): Part[] {
  return ctx.design.partIds
    .map((id) => ctx.content.parts.find((p) => p.id === id))
    .filter((p): p is Part => p !== undefined)
}

export function sumStat(parts: readonly Part[], key: PartStatKey): number {
  return parts.reduce((acc, p) => acc + (p.stats[key] ?? 0), 0)
}

export function bestStat(parts: readonly Part[], key: PartStatKey): number {
  return parts.reduce((best, p) => Math.max(best, p.stats[key] ?? 0), 0)
}

/** Product of all active multipliers on a modifier (1 when none). */
export function modifier(s: MissionState, key: ModifierKey): number {
  return s.activeEffects.filter((e) => e.target === key).reduce((acc, e) => acc * e.value, 1)
}

/** Battery capacity of the parts that are online, Wh. */
export function batteryCapacityWh(s: MissionState, ctx: MissionContext): number {
  return sumStat(activeParts(s, ctx), 'capacityWh')
}

export function crewMembers(ctx: MissionContext): CrewMember[] {
  return ctx.design.crewIds
    .map((id) => ctx.content.crew.find((c) => c.id === id))
    .filter((c): c is CrewMember => c !== undefined)
}

export function crewName(ctx: MissionContext, id: string): string {
  return ctx.content.crew.find((c) => c.id === id)?.name ?? id
}

export function teamModifiers(ctx: MissionContext): TeamModifiers {
  return analyzeTeam(crewMembers(ctx), ctx.content.constants.teamRules).modifiers
}

export function averageMorale(s: MissionState): number {
  const crew = Object.values(s.crew)
  return crew.length === 0 ? 100 : crew.reduce((acc, c) => acc + c.morale, 0) / crew.length
}

/** Player-facing role names for log text (the engine cannot import UI labels). */
export const ROLE_NAMES = {
  science: 'Science',
  power_life: 'Power & Life Support',
  comms_nav: 'Comms & Navigation',
  launch_budget: 'Launch & Budget',
} as const
