/**
 * Applies typed event effects to a mission state draft. Resources and crew stats are clamped
 * so nothing ever goes negative. Pure TypeScript (CLAUDE.md rule 1).
 */
import {
  MODIFIER_KEYS,
  RESOURCE_KEYS,
  type EventEffect,
  type ModifierKey,
  type ResourceKey,
} from '@/schemas'
import { fmt } from './format'
import { recordChange } from './history'
import { batteryCapacityWh, clamp, crewName } from './missionHelpers'
import type { Rng } from './rng'
import type { MissionContext, MissionState } from './types'

const isResource = (t: string): t is ResourceKey => (RESOURCE_KEYS as readonly string[]).includes(t)
const isModifier = (t: string): t is ModifierKey => (MODIFIER_KEYS as readonly string[]).includes(t)

function applyOp(current: number, op: EventEffect['op'], value: number): number {
  if (op === 'add') return current + value
  if (op === 'multiply') return current * value
  if (op === 'set') return value
  return current
}

/**
 * Applies one effect to the draft `s` (mutates it) and returns a short description.
 * actingCrewId is the crew member who took the action (for target "actingCrew").
 */
export function applyEffect(
  s: MissionState,
  e: EventEffect,
  ctx: MissionContext,
  rng: Rng,
  actingCrewId: string | null,
  eventId: string,
): string {
  const t = e.target
  const turns = e.durationTurns ?? 1

  if (isResource(t)) {
    const before = s.resources[t]
    let after = Math.max(0, applyOp(before, e.op, e.value))
    if (t === 'batteryWh') after = Math.min(after, batteryCapacityWh(s, ctx))
    s.resources[t] = after
    const text = `${t} ${fmt(before, 1)} → ${fmt(after, 1)}`
    recordChange(s, t, after - before, 'event', eventId, text)
    return text
  }

  if (isModifier(t)) {
    s.activeEffects.push({ target: t, value: e.value, turnsLeft: turns, sourceEventId: eventId })
    const text = `${t} ×${e.value} for ${turns} turn${turns === 1 ? '' : 's'}`
    recordChange(s, t, e.value - 1, 'event', eventId, text)
    return text
  }

  if (t === 'dustLevel') {
    const before = s.dustLevel
    s.dustLevel = clamp(applyOp(before, e.op, e.value), 0, 1)
    const text = `dust ${Math.round(before * 100)}% → ${Math.round(s.dustLevel * 100)}%`
    recordChange(s, 'dustLevel', s.dustLevel - before, 'event', eventId, text)
    return text
  }

  if (t.startsWith('part:')) {
    const category = t.slice('part:'.length)
    const ids = [
      ...new Set(
        ctx.design.partIds.filter(
          (id) => ctx.content.parts.find((p) => p.id === id)?.category === category,
        ),
      ),
    ]
    ids.forEach((id) => (s.disabledParts[id] = Math.max(s.disabledParts[id] ?? 0, turns)))
    const text =
      ids.length > 0
        ? `${category} offline for ${turns} turn${turns === 1 ? '' : 's'}`
        : `no ${category} affected`
    if (ids.length > 0) recordChange(s, t, -turns, 'event', eventId, text)
    return text
  }

  // Crew target.
  const stat = e.stat ?? 'health'
  const alive = Object.keys(s.crew).filter((id) => (s.crew[id]?.health ?? 0) > 0)
  const ids =
    t === 'allCrew'
      ? alive
      : t === 'randomCrew'
        ? alive.length > 0
          ? [rng.pick(alive)]
          : []
        : t === 'actingCrew'
          ? actingCrewId
            ? [actingCrewId]
            : []
          : [t]
  const changed: string[] = []
  for (const id of ids) {
    const c = s.crew[id]
    if (!c) continue
    const before = c[stat]
    c[stat] = clamp(applyOp(c[stat], e.op, e.value), 0, 100)
    recordChange(
      s,
      `${stat}:${id}`,
      c[stat] - before,
      'event',
      eventId,
      `${crewName(ctx, id)} ${stat}`,
    )
    changed.push(crewName(ctx, id))
  }
  const who = t === 'allCrew' ? 'all crew' : changed.join(', ') || 'nobody'
  return `${who} ${stat} ${e.op === 'add' && e.value >= 0 ? '+' : ''}${e.op === 'add' ? e.value : `${e.op} ${e.value}`}`
}
