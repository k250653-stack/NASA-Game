/**
 * Planning Board engine: who owns what, editing a design through DesignChanges, and the AI
 * teammates' first proposal. Pure TypeScript (CLAUDE.md rule 1); randomness only via Rng.
 */
import type {
  CrewMember,
  Destination,
  Difficulty,
  Part,
  PartCategory,
  Priorities,
  Role,
  RoleChoice,
  Scenario,
} from '@/schemas'
import { computeTotals, rocketCapacityKg } from './budget'
import { lifeSupportNeedKg } from './physics'
import { playerCharacterId, playerRoleOf } from './recruitment'
import type { Rng } from './rng'
import { missionTimeline, totalMissionDays } from './timeline'
import type { Design, EngineContent, Supplies } from './types'

export type SupplyKey = keyof Supplies

/** One edit to a design. Trades are lists of these. */
export type DesignChange =
  | { kind: 'addPart'; partId: string }
  | { kind: 'removePart'; partId: string }
  | { kind: 'swapPart'; fromId: string; toId: string }
  | { kind: 'supply'; resource: SupplyKey; deltaKg: number }
  | { kind: 'rocket'; rocketId: string }

/** Priorities used for the player's own seat and the Mission Director's defaults. */
export const BALANCED: Priorities = { science: 0.34, safety: 0.33, cost: 0.33 }

const partOf = (id: string, content: EngineContent): Part | undefined =>
  content.parts.find((p) => p.id === id)

// ---------------------------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------------------------

/** The crew role that owns a part category, supplies or the rocket (from roles.json "owns"). */
export function ownerOfCategory(category: PartCategory, content: EngineContent): Role {
  const r = content.roles.find((x) => x.id !== 'director' && x.owns.categories.includes(category))
  if (!r || r.id === 'director') throw new Error(`No role owns category "${category}"`)
  return r.id
}

function ownerOfFlag(flag: 'supplies' | 'rocket', content: EngineContent): Role {
  const r = content.roles.find((x) => x.id !== 'director' && x.owns[flag])
  if (!r || r.id === 'director') throw new Error(`No role owns ${flag}`)
  return r.id
}

/** The role that controls what a change touches. */
export function ownerOfChange(change: DesignChange, content: EngineContent): Role {
  switch (change.kind) {
    case 'supply':
      return ownerOfFlag('supplies', content)
    case 'rocket':
      return ownerOfFlag('rocket', content)
    default: {
      const id = change.kind === 'swapPart' ? change.fromId : change.partId
      const part = partOf(id, content)
      if (!part) throw new Error(`Unknown part "${id}"`)
      return ownerOfCategory(part.category, content)
    }
  }
}

/** Can this seat make this change? The Mission Director can edit everything. */
export function canEdit(seat: RoleChoice, change: DesignChange, content: EngineContent): boolean {
  if (seat === 'director') return true
  if (change.kind === 'swapPart') {
    const to = partOf(change.toId, content)
    if (!to || ownerOfCategory(to.category, content) !== seat) return false
  }
  return ownerOfChange(change, content) === seat
}

// ---------------------------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------------------------

/** Applies one change and returns a new design. Supplies never go below 0. */
export function applyChange(design: Design, change: DesignChange): Design {
  switch (change.kind) {
    case 'addPart':
      return { ...design, partIds: [...design.partIds, change.partId] }
    case 'removePart': {
      const i = design.partIds.indexOf(change.partId)
      return i < 0 ? design : { ...design, partIds: design.partIds.filter((_, j) => j !== i) }
    }
    case 'swapPart': {
      const i = design.partIds.indexOf(change.fromId)
      return i < 0
        ? design
        : { ...design, partIds: design.partIds.map((id, j) => (j === i ? change.toId : id)) }
    }
    case 'supply':
      return {
        ...design,
        supplies: {
          ...design.supplies,
          [change.resource]: Math.max(0, design.supplies[change.resource] + change.deltaKg),
        },
      }
    case 'rocket':
      return { ...design, rocketId: change.rocketId }
  }
}

export function applyChanges(design: Design, changes: readonly DesignChange[]): Design {
  return changes.reduce(applyChange, design)
}

/** Applies a change only if the seat owns it; otherwise returns the reason. */
export function editDesign(
  design: Design,
  seat: RoleChoice,
  change: DesignChange,
  content: EngineContent,
): { design: Design; refused?: string } {
  if (!canEdit(seat, change, content)) {
    const owner = ownerOfChange(change, content)
    return {
      design,
      refused: `That belongs to the ${content.roles.find((r) => r.id === owner)?.name ?? owner} seat.`,
    }
  }
  return { design: applyChange(design, change) }
}

// ---------------------------------------------------------------------------------------------
// Supplies in days
// ---------------------------------------------------------------------------------------------

const PER_DAY_KEY = { waterKg: 'waterKg', foodKg: 'foodKg', oxygenKg: 'oxygenKg' } as const

/** kg of one consumable per day for the crew, after the design's recycling. */
export function supplyKgPerDay(
  design: Design,
  resource: SupplyKey,
  content: EngineContent,
): number {
  const t = computeTotals(design, content)
  const rate = content.constants.perCrewPerDay[PER_DAY_KEY[resource]]
  const recovery =
    resource === 'waterKg'
      ? t.waterRecoveryRate
      : resource === 'oxygenKg'
        ? t.oxygenRecoveryRate
        : 0
  return t.crewCount * rate * (1 - recovery)
}

/** Days of supply ↔ kg, for the supplies sliders. */
export function supplyDaysToKg(
  design: Design,
  resource: SupplyKey,
  days: number,
  content: EngineContent,
): number {
  return Math.max(0, days) * supplyKgPerDay(design, resource, content)
}

export function supplyKgToDays(
  design: Design,
  resource: SupplyKey,
  kg: number,
  content: EngineContent,
): number {
  const perDay = supplyKgPerDay(design, resource, content)
  return perDay > 0 ? kg / perDay : Number.POSITIVE_INFINITY
}

// ---------------------------------------------------------------------------------------------
// First proposal
// ---------------------------------------------------------------------------------------------

export interface ProposalInput {
  scenario: Scenario
  destination: Destination
  /** Recruited crew (not the player character). */
  crew: readonly CrewMember[]
  seat: RoleChoice
  difficulty: Difficulty
}

/** Mass the overshoot may reach above capacity, and the window it aims for. */
const OVERSHOOT_MIN = 1.05
const OVERSHOOT_MAX = 1.2

export { buildProposal as proposeInitialDesign } from './proposal'
export { OVERSHOOT_MAX, OVERSHOOT_MIN }

/** Shared helpers for proposal.ts (kept here so proposal.ts stays focused on choices). */
export function crewPriorities(input: ProposalInput, role: Role): Priorities {
  if (playerRoleOf(input.seat) === role || input.seat === 'director') return BALANCED
  return input.crew.find((m) => m.role === role)?.priorities ?? BALANCED
}

export function isPlayerRole(input: ProposalInput, role: Role): boolean {
  return input.seat === 'director' || playerRoleOf(input.seat) === role
}

export function baseDesign(input: ProposalInput): Design {
  return {
    destinationId: input.destination.id,
    scenarioId: input.scenario.id,
    rocketId: null,
    partIds: [],
    supplies: { waterKg: 0, foodKg: 0, oxygenKg: 0 },
    crewIds: [playerCharacterId(input.seat), ...input.crew.map((m) => m.id)],
    standingOrders: input.scenario.defaultStandingOrders,
    playerRole: playerRoleOf(input.seat),
    difficulty: input.difficulty,
  }
}

/** Supplies for the whole mission + reserve, plus a safety-scaled buffer for a recycler outage. */
export function sizeSupplies(
  design: Design,
  input: ProposalInput,
  p: Priorities,
  content: EngineContent,
): Supplies {
  const t = computeTotals(design, content)
  const C = content.constants
  const days = totalMissionDays(input.destination) + C.reserveDaysRequired.value
  const need = lifeSupportNeedKg(
    t.crewCount,
    days,
    C.perCrewPerDay,
    t.waterRecoveryRate,
    t.oxygenRecoveryRate,
  )
  const longestTurn = Math.max(...missionTimeline(input.destination).map((x) => x.days))
  const outageWater = t.crewCount * C.perCrewPerDay.waterKg * longestTurn * p.safety
  const outageO2 =
    t.crewCount *
    C.perCrewPerDay.oxygenKg *
    longestTurn *
    p.safety *
    (t.oxygenRecoveryRate > 0 ? 1 : 0)
  return {
    waterKg: Math.ceil(need.water + outageWater),
    foodKg: Math.ceil(need.food),
    oxygenKg: Math.ceil(need.oxygen + outageO2),
  }
}

/** Ratio of total mass to the chosen rocket's capacity (Infinity with no rocket). */
export function massRatio(
  design: Design,
  content: EngineContent,
  destination: Destination,
): number {
  const rocket = content.rockets.find((r) => r.id === design.rocketId) ?? null
  const cap = rocketCapacityKg(rocket, destination)
  return cap > 0 ? computeTotals(design, content).massKg / cap : Number.POSITIVE_INFINITY
}

export type { Rng }
