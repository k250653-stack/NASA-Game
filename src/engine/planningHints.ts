/**
 * Planning Board read-outs: margin gauges, per-role usage, launch readiness, and the Hint
 * button's fix suggestions. Pure TypeScript (CLAUDE.md rule 1).
 */
import type { PartCategory, Role } from '@/schemas'
import { computeTotals, resolveDesign, rocketCapacityKg } from './budget'
import { effectiveBudgetM } from './difficulty'
import { fmt } from './format'
import { canLaunch, runLaunchCheck } from './launchCheck'
import { daysOfSupply } from './physics'
import { applyChange, ownerOfChange, type DesignChange } from './planning'
import { totalMissionDays } from './timeline'
import type { Check, CheckStatus, Design, EngineContent } from './types'

export interface Gauge {
  id: 'mass' | 'budget' | 'power' | 'battery' | 'data' | 'supplies'
  label: string
  icon: string
  value: number
  max: number
  unit: string
  status: CheckStatus
  /** The launch check's sentence, for the tooltip. */
  explanation: string
}

const STATUS_RANK: Record<CheckStatus, number> = { ok: 0, warn: 1, fail: 2 }

/** The six bars in the right column, with status and text straight from runLaunchCheck. */
export function planningGauges(design: Design, content: EngineContent): Gauge[] {
  const checks = runLaunchCheck(design, content)
  const byId = (id: Check['id']) => checks.find((c) => c.id === id)!
  const t = computeTotals(design, content)
  const supply = byId('supplies')
  const worst = (...ids: Check['id'][]) =>
    ids.map(byId).reduce((w, c) => (STATUS_RANK[c.status] > STATUS_RANK[w.status] ? c : w))
  const massCheck = worst('mass', 'supply-feasibility')
  const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback)
  return [
    {
      id: 'mass',
      label: 'Mass',
      icon: 'IconWeight',
      value: t.massKg,
      max: byId('mass').limit,
      unit: 'kg',
      status: massCheck.status,
      explanation: massCheck.explanation,
    },
    {
      id: 'budget',
      label: 'Budget',
      icon: 'IconCoin',
      value: t.costM,
      max: byId('budget').limit,
      unit: '$M',
      status: byId('budget').status,
      explanation: byId('budget').explanation,
    },
    {
      id: 'power',
      label: 'Power use',
      icon: 'IconBolt',
      value: t.powerUseW,
      max: t.powerGenW,
      unit: 'W',
      status: byId('power').status,
      explanation: byId('power').explanation,
    },
    {
      id: 'battery',
      label: byId('battery').limit > 0 ? 'Night battery' : 'Night battery (not needed)',
      icon: 'IconBattery',
      value: t.batteryWh,
      max: Math.max(byId('battery').limit, 1),
      unit: 'Wh',
      status: byId('battery').status,
      explanation: byId('battery').explanation,
    },
    {
      id: 'data',
      label: 'Data home',
      icon: 'IconAntenna',
      value: Math.min(t.dataReturnGbPerDay, t.dataGenGbPerDay),
      max: Math.max(t.dataGenGbPerDay, 0.001),
      unit: 'GB/day',
      status: byId('data').status,
      explanation: byId('data').explanation,
    },
    {
      id: 'supplies',
      label: 'Supply days',
      icon: 'IconDroplet',
      value: finite(supply.value, supply.limit),
      max: supply.limit,
      unit: 'days',
      status: supply.status,
      explanation: supply.explanation,
    },
  ]
}

export interface Readiness {
  level: 'green' | 'amber' | 'red'
  fails: number
  warns: number
  canLaunch: boolean
}

export function launchReadiness(design: Design, content: EngineContent): Readiness {
  const checks = runLaunchCheck(design, content)
  const fails = checks.filter((c) => c.status === 'fail').length
  const warns = checks.filter((c) => c.status === 'warn').length
  return {
    level: fails ? 'red' : warns ? 'amber' : 'green',
    fails,
    warns,
    canLaunch: canLaunch(checks),
  }
}

export interface RoleUsage {
  massKg: number
  powerW: number
  costM: number
  partCount: number
}

/** What each seat is currently using: its parts, plus supplies (Power & Life) or the rocket (Launch). */
export function roleUsage(design: Design, role: Role, content: EngineContent): RoleUsage {
  const owned = content.roles.find((r) => r.id === role)?.owns
  const parts = design.partIds
    .map((id) => content.parts.find((p) => p.id === id))
    .filter((p) => p && owned?.categories.includes(p.category as PartCategory))
  const supplies = owned?.supplies
    ? design.supplies.waterKg + design.supplies.foodKg + design.supplies.oxygenKg
    : 0
  const rocketCost = owned?.rocket
    ? (content.rockets.find((r) => r.id === design.rocketId)?.costM ?? 0)
    : 0
  return {
    massKg: parts.reduce((a, p) => a + (p?.massKg ?? 0), 0) + supplies,
    powerW: parts.reduce((a, p) => a + Math.max(0, -(p?.powerW ?? 0)), 0),
    costM: parts.reduce((a, p) => a + (p?.costM ?? 0), 0) + rocketCost,
    partCount: parts.length,
  }
}

/** Days each supply lasts with the design's recycling, and which runs out first. */
export function supplyReadout(design: Design, content: EngineContent) {
  const t = computeTotals(design, content)
  const { destination } = resolveDesign(design, content)
  const d = daysOfSupply(
    design.supplies,
    t.crewCount,
    content.constants.perCrewPerDay,
    t.waterRecoveryRate,
    t.oxygenRecoveryRate,
  )
  return {
    ...d,
    missionDays: totalMissionDays(destination),
    requiredDays: totalMissionDays(destination) + content.constants.reserveDaysRequired.value,
  }
}

export interface Suggestion {
  text: string
  change: DesignChange
  owner: Role
  massDeltaKg: number
  costDeltaM: number
}

function overBy(design: Design, content: EngineContent) {
  const t = computeTotals(design, content)
  const { rocket, destination, scenario } = resolveDesign(design, content)
  return {
    mass: Math.max(0, t.massKg - rocketCapacityKg(rocket, destination)),
    budget: Math.max(0, t.costM - effectiveBudgetM(scenario, design.difficulty, content)),
    fails: runLaunchCheck(design, content).filter(
      (c) =>
        c.status === 'fail' &&
        c.id !== 'mass' &&
        c.id !== 'budget' &&
        c.id !== 'supply-feasibility',
    ).length,
  }
}

/**
 * Up to 3 single changes that reduce the overshoot without breaking another check:
 * removing or swapping a part for a lighter/cheaper one in the same category, trimming
 * supplies above what the mission needs, or a bigger rocket. Best (largest reduction) first.
 */
export function suggestFixes(design: Design, content: EngineContent): Suggestion[] {
  const before = overBy(design, content)
  if (before.mass === 0 && before.budget === 0) return []
  const t0 = computeTotals(design, content)
  const candidates: Array<{ change: DesignChange; text: string }> = []
  for (const id of new Set(design.partIds)) {
    const part = content.parts.find((p) => p.id === id)
    if (!part) continue
    candidates.push({ change: { kind: 'removePart', partId: id }, text: `Remove ${part.name}` })
    for (const alt of content.parts.filter(
      (p) =>
        p.category === part.category &&
        p.id !== id &&
        (p.massKg < part.massKg || p.costM < part.costM),
    )) {
      candidates.push({
        change: { kind: 'swapPart', fromId: id, toId: alt.id },
        text: `Swap ${part.name} for ${alt.name}`,
      })
    }
  }
  const supply = supplyReadout(design, content)
  for (const [key, days] of [
    ['waterKg', supply.water],
    ['foodKg', supply.food],
    ['oxygenKg', supply.oxygen],
  ] as const) {
    const spare = days - supply.requiredDays
    if (Number.isFinite(spare) && spare > 1) {
      const kg = Math.floor((design.supplies[key] * spare) / days)
      if (kg > 0)
        candidates.push({
          change: { kind: 'supply', resource: key, deltaKg: -kg },
          text: `Pack ${fmt(spare, 0)} fewer days of ${key.replace('Kg', '')}`,
        })
    }
  }
  const { destination } = resolveDesign(design, content)
  for (const r of content.rockets.filter(
    (r) => rocketCapacityKg(r, destination) > t0.massKg && r.id !== design.rocketId,
  )) {
    candidates.push({ change: { kind: 'rocket', rocketId: r.id }, text: `Switch to the ${r.name}` })
  }

  return candidates
    .map(({ change, text }) => {
      const after = applyChange(design, change)
      const o = overBy(after, content)
      const t1 = computeTotals(after, content)
      const gain =
        (before.mass - o.mass) / Math.max(1, before.mass || 1) +
        (before.budget - o.budget) / Math.max(1, before.budget || 1)
      return {
        change,
        text,
        o,
        gain,
        massDeltaKg: t1.massKg - t0.massKg,
        costDeltaM: t1.costM - t0.costM,
      }
    })
    .filter((x) => x.gain > 0 && x.o.fails <= before.fails && x.o.budget <= before.budget + 1e-6)
    .sort((a, b) => b.gain - a.gain || a.massDeltaKg - b.massDeltaKg)
    .slice(0, 3)
    .map((x) => ({
      text: `${x.text}: ${x.massDeltaKg <= 0 ? '−' : '+'}${fmt(Math.abs(x.massDeltaKg))} kg, ${x.costDeltaM <= 0 ? '−' : '+'}$${fmt(Math.abs(x.costDeltaM), 1)}M.`,
      change: x.change,
      owner: ownerOfChange(x.change, content),
      massDeltaKg: x.massDeltaKg,
      costDeltaM: x.costDeltaM,
    }))
}
