/**
 * Planning Board choices: what each seat can offer in a trade, and how the design fits each
 * rocket. Pure TypeScript (CLAUDE.md rule 1).
 */
import type { Role } from '@/schemas'
import { computeTotals, resolveDesign, rocketCapacityKg } from './budget'
import { fmt } from './format'
import type { DesignChange } from './planning'
import type { CheckStatus, Design, EngineContent } from './types'

export interface TradeOption {
  /** Stable key for selects. */
  key: string
  label: string
  change: DesignChange
}

/** Share of a supply offered per trade step ("10% less water"). */
const SUPPLY_STEP = 0.1

/**
 * Everything a seat could offer, or be asked for, in a trade: remove or swap each of its parts,
 * pack 10% more or less of each supply, or switch rocket.
 */
export function tradeOptions(design: Design, role: Role, content: EngineContent): TradeOption[] {
  const owned = content.roles.find((r) => r.id === role)?.owns
  if (!owned) return []
  const out: TradeOption[] = []
  for (const id of new Set(design.partIds)) {
    const part = content.parts.find((p) => p.id === id)
    if (!part || !owned.categories.includes(part.category)) continue
    out.push({
      key: `remove:${id}`,
      label: `Remove ${part.name} (−${fmt(part.massKg)} kg)`,
      change: { kind: 'removePart', partId: id },
    })
    for (const alt of content.parts.filter((p) => p.category === part.category && p.id !== id)) {
      const dm = alt.massKg - part.massKg
      out.push({
        key: `swap:${id}:${alt.id}`,
        label: `Swap ${part.name} → ${alt.name} (${dm <= 0 ? '−' : '+'}${fmt(Math.abs(dm))} kg)`,
        change: { kind: 'swapPart', fromId: id, toId: alt.id },
      })
    }
  }
  if (owned.supplies) {
    for (const key of ['waterKg', 'foodKg', 'oxygenKg'] as const) {
      const kg = Math.round(design.supplies[key] * SUPPLY_STEP)
      if (kg < 1) continue
      const name = key.replace('Kg', '')
      out.push({
        key: `supply:${key}:less`,
        label: `Pack 10% less ${name} (−${fmt(kg)} kg)`,
        change: { kind: 'supply', resource: key, deltaKg: -kg },
      })
      out.push({
        key: `supply:${key}:more`,
        label: `Pack 10% more ${name} (+${fmt(kg)} kg)`,
        change: { kind: 'supply', resource: key, deltaKg: kg },
      })
    }
  }
  if (owned.rocket) {
    const { destination } = resolveDesign(design, content)
    for (const r of content.rockets) {
      const cap = rocketCapacityKg(r, destination)
      if (r.id === design.rocketId || cap <= 0) continue
      out.push({
        key: `rocket:${r.id}`,
        label: `Switch to ${r.name} (${fmt(cap)} kg, $${fmt(r.costM)}M)`,
        change: { kind: 'rocket', rocketId: r.id },
      })
    }
  }
  return out
}

export interface RocketFit {
  rocketId: string
  capacityKg: number
  massKg: number
  status: CheckStatus
}

/** How the current design would fit each rocket that reaches the destination. */
export function rocketFits(design: Design, content: EngineContent): RocketFit[] {
  const { destination } = resolveDesign(design, content)
  const massKg = computeTotals(design, content).massKg
  const target = content.constants.massMarginTarget.value
  return content.rockets
    .filter((r) => rocketCapacityKg(r, destination) > 0)
    .map((r) => {
      const capacityKg = rocketCapacityKg(r, destination)
      const status: CheckStatus =
        massKg > capacityKg ? 'fail' : (capacityKg - massKg) / capacityKg < target ? 'warn' : 'ok'
      return { rocketId: r.id, capacityKg, massKg, status }
    })
}
