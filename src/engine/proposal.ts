/**
 * The AI teammates' first proposal for the Planning Board.
 *
 * 1. Each seat picks parts for its own categories by its priorities (science-heavy crew pick
 *    more instruments, safety-heavy pick bigger batteries and buffers, cost-heavy pick cheap
 *    parts). The player's own seat starts from balanced defaults.
 * 2. Power and batteries are sized to the loads, supplies to the mission length.
 * 3. Except on Cadet, AI teammates add "wishlist" items until the team is 5–20% over the
 *    rocket's capacity, so the crew has to negotiate. On Cadet the proposal fits.
 * Pure TypeScript; the Rng only picks the overshoot target.
 */
import { ROLES, type Part, type PartCategory, type Priorities, type Role } from '@/schemas'
import { computeTotals, rocketCapacityKg } from './budget'
import { dataReturnedGbPerDay } from './physics'
import {
  applyChange,
  baseDesign,
  crewPriorities,
  isPlayerRole,
  massRatio,
  OVERSHOOT_MAX,
  OVERSHOOT_MIN,
  sizeSupplies,
  type DesignChange,
  type ProposalInput,
} from './planning'
import type { Rng } from './rng'
import { totalMissionDays } from './timeline'
import type { Design, EngineContent } from './types'

const LONG_MISSION_DAYS = 365
/** Water top-up allowed to reach the overshoot window, as a share of total mass. */
const MAX_TOP_UP_SHARE = 0.15
/** How much each seat values one unit of a category when deciding wishlist items. */
const SAFETY_VALUE: Partial<Record<PartCategory, number>> = {
  battery: 1,
  life_support: 1,
  spares: 0.8,
  habitat: 0.6,
  suit: 0.5,
  comms: 0.4,
  rover: 0.2,
}

const byCategory = (c: EngineContent, cat: PartCategory) =>
  c.parts.filter((p) => p.category === cat)
const minBy = <T>(xs: readonly T[], f: (x: T) => number): T | undefined =>
  xs.reduce<T | undefined>(
    (best, x) => (best === undefined || f(x) < f(best) ? x : best),
    undefined,
  )

function scienceScore(p: Priorities, part: Part): number {
  return (
    p.science * (part.stats.sciencePointsPerDay ?? 0) -
    (p.cost * part.costM) / 20 -
    (p.safety * part.massKg) / 200
  )
}

function pickScience(c: EngineContent, p: Priorities): string[] {
  const ranked = [...byCategory(c, 'instrument')].sort(
    (a, b) => scienceScore(p, b) - scienceScore(p, a),
  )
  return ranked.slice(0, p.science >= 0.4 ? 2 : 1).map((x) => x.id)
}

function pickComms(
  design: Design,
  input: ProposalInput,
  c: EngineContent,
  p: Priorities,
): string[] {
  const gen = computeTotals(design, c).dataGenGbPerDay
  const enough = byCategory(c, 'comms').filter(
    (x) =>
      dataReturnedGbPerDay(x.stats.dataRateMbps ?? 0, input.destination.contactHoursPerDay) >=
      gen * (1 + p.safety),
  )
  const pick =
    minBy(enough, (x) => x.costM) ??
    minBy(byCategory(c, 'comms'), (x) => -(x.stats.dataRateMbps ?? 0))
  return pick ? [pick.id] : []
}

function pickPowerLife(input: ProposalInput, c: EngineContent, p: Priorities): string[] {
  const ids: string[] = []
  const days = totalMissionDays(input.destination)
  const ls = byCategory(c, 'life_support')
  if (days >= LONG_MISSION_DAYS) {
    const water = minBy(ls, (x) => -(x.stats.waterRecoveryRate ?? 0))
    const oxygen = minBy(
      ls.filter((x) => x.stats.oxygenRecoveryRate),
      (x) => -(x.stats.oxygenRecoveryRate ?? 0),
    )
    if (water) ids.push(water.id)
    if (oxygen) ids.push(oxygen.id)
  } else {
    const pick =
      p.cost > p.safety
        ? minBy(ls, (x) => x.costM)
        : minBy(
            ls.filter((x) => (x.stats.waterRecoveryRate ?? 0) >= 0.85),
            (x) => x.massKg,
          )
    if (pick) ids.push(pick.id)
  }
  const habitat = minBy(
    byCategory(c, 'habitat').filter((x) => (x.stats.crewCapacity ?? 0) >= input.scenario.crewSize),
    (x) => x.massKg,
  )
  if (habitat) ids.push(habitat.id)
  const shelter = minBy(
    byCategory(c, 'habitat').filter(
      (x) => (x.stats.radiationShielding ?? 0) >= 0.5 && !x.stats.crewCapacity,
    ),
    (x) => x.massKg,
  )
  if (shelter && input.destination.hazards.includes('radiation') && p.safety >= 0.5)
    ids.push(shelter.id)
  const suits = byCategory(c, 'suit').find(
    (x) => (x.stats.suitCount ?? 0) === (p.safety >= 0.5 ? 2 : 1),
  )
  if (suits) ids.push(suits.id)
  const spareParts = byCategory(c, 'spares')
  const wantMany = days >= LONG_MISSION_DAYS || p.safety >= 0.6
  const spares = minBy(spareParts, (x) => (wantMany ? -1 : 1) * (x.stats.spareKits ?? 0))
  if (spares) ids.push(spares.id)
  return ids
}

/**
 * Replaces power and battery parts with ones sized to the current loads. extraIds are wishlist
 * extras (e.g. an extra battery a teammate asked for): they are kept on top of the sized set.
 */
export function sizePower(
  design: Design,
  input: ProposalInput,
  c: EngineContent,
  p: Priorities,
  extraIds: readonly string[] = [],
): Design {
  const extras = [...extraIds]
  const keep = design.partIds.filter((id) => {
    const i = extras.indexOf(id)
    if (i >= 0) {
      extras.splice(i, 1)
      return false
    }
    const cat = c.parts.find((x) => x.id === id)?.category
    return cat !== 'power' && cat !== 'battery'
  })
  const loads = keep.reduce(
    (acc, id) => acc + Math.max(0, -(c.parts.find((x) => x.id === id)?.powerW ?? 0)),
    0,
  )
  const d = input.destination
  const sun = d.sunlightFactor * d.lightFraction
  const target = c.constants.powerMarginTarget.value
  const ids = [...keep]
  let steadyW = 0
  const repeat = (id: string, n: number) => Array.from({ length: Math.max(0, n) }, () => id)
  if (sun < 0.3) {
    const steady = minBy(
      byCategory(c, 'power').filter((x) => x.powerW > 0),
      (x) => x.massKg / x.powerW,
    )
    if (steady) {
      const n = Math.ceil((loads * (1 + target + 0.05)) / steady.powerW)
      ids.push(...repeat(steady.id, n))
      steadyW = n * steady.powerW
    }
  } else {
    const solar = byCategory(c, 'power').filter((x) => x.stats.ratedPowerW)
    const pick = minBy(
      solar,
      (x) => (p.cost > p.safety ? x.costM : x.massKg) / (x.stats.ratedPowerW ?? 1),
    )
    if (pick)
      ids.push(
        ...repeat(
          pick.id,
          Math.ceil((loads * (1 + target + 0.1)) / ((pick.stats.ratedPowerW ?? 1) * sun)),
        ),
      )
  }
  const need = Math.max(0, loads - steadyW) * d.darkPeriodHours * (1 + 0.2 * p.safety)
  if (need > 0) {
    const battery = minBy(
      byCategory(c, 'battery'),
      (x) => (p.cost > p.safety ? x.costM : x.massKg) / (x.stats.capacityWh ?? 1),
    )
    if (battery) ids.push(...repeat(battery.id, Math.ceil(need / (battery.stats.capacityWh ?? 1))))
  }
  return { ...design, partIds: [...ids, ...extraIds] }
}

/** Cheapest rocket that reaches the destination with the mass margin target (largest if none). */
function pickRocket(design: Design, input: ProposalInput, c: EngineContent): string | null {
  const mass = computeTotals(design, c).massKg * (1 + c.constants.massMarginTarget.value + 0.05)
  const reach = c.rockets.filter((r) => rocketCapacityKg(r, input.destination) > 0)
  const fits = reach.filter((r) => rocketCapacityKg(r, input.destination) >= mass)
  return (
    (minBy(fits, (r) => r.costM) ?? minBy(reach, (r) => -rocketCapacityKg(r, input.destination)))
      ?.id ?? null
  )
}

/** A swap only counts as an upgrade if the new part does the same job better. */
function isUpgrade(from: Part, to: Part): boolean {
  switch (from.category) {
    case 'habitat':
      return (
        (from.stats.crewCapacity ?? 0) > 0 &&
        (to.stats.crewCapacity ?? 0) >= (from.stats.crewCapacity ?? 0)
      )
    case 'comms':
      return (to.stats.dataRateMbps ?? 0) > (from.stats.dataRateMbps ?? 0)
    case 'life_support':
      return (
        (to.stats.waterRecoveryRate ?? 0) > (from.stats.waterRecoveryRate ?? 0) &&
        (to.stats.oxygenRecoveryRate ?? 0) >= (from.stats.oxygenRecoveryRate ?? 0)
      )
    default:
      return false
  }
}

interface WishItem {
  role: Role
  change: DesignChange
  score: number
}

/** Extra items AI teammates would like, best first, alternating between teammates. */
function wishlist(design: Design, input: ProposalInput, c: EngineContent): WishItem[] {
  const perRole = ROLES.filter((r) => !isPlayerRole(input, r)).map((role) => {
    const p = crewPriorities(input, role)
    const owned = c.roles.find((x) => x.id === role)?.owns.categories ?? []
    const items: WishItem[] = []
    for (const part of c.parts.filter((x) => owned.includes(x.category))) {
      const inDesign = design.partIds.includes(part.id)
      const score =
        p.science * (part.stats.sciencePointsPerDay ?? 0) * 0.5 +
        p.safety * (SAFETY_VALUE[part.category] ?? 0) -
        (p.cost * part.costM) / 50
      const additive =
        part.category === 'instrument' ||
        part.category === 'rover' ||
        part.category === 'battery' ||
        part.category === 'spares'
      if (additive && !inDesign)
        items.push({ role, change: { kind: 'addPart', partId: part.id }, score })
      // Upgrades: swap the current part of a single-unit category for a bigger one.
      const current = design.partIds
        .map((id) => c.parts.find((x) => x.id === id))
        .find((x) => x?.category === part.category)
      if (
        !additive &&
        current &&
        current.id !== part.id &&
        part.massKg > current.massKg &&
        isUpgrade(current, part)
      ) {
        items.push({
          role,
          change: { kind: 'swapPart', fromId: current.id, toId: part.id },
          score: score - (p.cost * (part.costM - current.costM)) / 50,
        })
      }
    }
    return items.sort((a, b) => b.score - a.score)
  })
  const out: WishItem[] = []
  for (let i = 0; perRole.some((list) => i < list.length); i++) {
    for (const list of perRole) {
      const item = list[i]
      if (item) out.push(item)
    }
  }
  return out
}

function isPowerOrBattery(id: string, c: EngineContent): boolean {
  const cat = c.parts.find((p) => p.id === id)?.category
  return cat === 'power' || cat === 'battery'
}

export function buildProposal(input: ProposalInput, content: EngineContent, rng: Rng): Design {
  const c = content
  let d = baseDesign(input)
  d = { ...d, partIds: [...pickScience(c, crewPriorities(input, 'science'))] }
  d = {
    ...d,
    partIds: [...d.partIds, ...pickPowerLife(input, c, crewPriorities(input, 'power_life'))],
  }
  d = {
    ...d,
    partIds: [...d.partIds, ...pickComms(d, input, c, crewPriorities(input, 'comms_nav'))],
  }
  const powerP = crewPriorities(input, 'power_life')
  const extras: string[] = []
  const finish = (x: Design) => {
    const sized = sizePower(x, input, c, powerP, extras)
    return { ...sized, supplies: sizeSupplies(sized, input, powerP, c) }
  }
  d = finish(d)
  const fitted = { ...d, rocketId: pickRocket(d, input, c) }
  if (input.difficulty === 'cadet') return fitted

  const target = OVERSHOOT_MIN + rng.next() * 0.1
  const wishes = wishlist(d, input, c)
  const rockets = c.rockets
    .filter((r) => rocketCapacityKg(r, input.destination) > 0)
    .sort((a, b) => rocketCapacityKg(a, input.destination) - rocketCapacityKg(b, input.destination))
  for (const rocket of rockets) {
    let x: Design = { ...d, rocketId: rocket.id }
    if (massRatio(x, c, input.destination) > OVERSHOOT_MAX) continue
    for (const w of wishes) {
      if (massRatio(x, c, input.destination) >= target) break
      const extra =
        w.change.kind === 'addPart' && isPowerOrBattery(w.change.partId, c) ? w.change.partId : null
      if (extra) extras.push(extra)
      const next = finish(applyChange(x, w.change))
      if (massRatio(next, c, input.destination) <= OVERSHOOT_MAX) x = next
      else if (extra) extras.pop()
    }
    const cap = rocketCapacityKg(rocket, input.destination)
    const mass = computeTotals(x, c).massKg
    if (mass / cap < OVERSHOOT_MIN) {
      const topUp = cap * target - mass
      if (topUp <= mass * MAX_TOP_UP_SHARE)
        x = { ...x, supplies: { ...x.supplies, waterKg: Math.ceil(x.supplies.waterKg + topUp) } }
    }
    const ratio = massRatio(x, c, input.destination)
    if (ratio >= OVERSHOOT_MIN && ratio <= OVERSHOOT_MAX) return x
  }
  return fitted
}
