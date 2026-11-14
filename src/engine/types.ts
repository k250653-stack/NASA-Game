/** Shared engine types. Pure data, no behaviour. */
import type { GameContent } from '@/content/load'
import type {
  Difficulty,
  Location,
  ModifierKey,
  ResourceKey,
  Role,
  StandingOrders,
  Weakness,
} from '@/schemas'

/** Consumables packed for the mission, kg. */
export interface Supplies {
  waterKg: number
  foodKg: number
  oxygenKg: number
}

/** Everything the player decides before launch. Ids refer to content JSON. */
export interface Design {
  destinationId: string
  scenarioId: string
  /** null until the player picks a launcher. */
  rocketId: string | null
  /** May repeat an id to fly several units (e.g. two battery packs). */
  partIds: string[]
  supplies: Supplies
  crewIds: string[]
  /** What the crew does when Earth can't answer in time; also steers AI teammates. */
  standingOrders: StandingOrders
  /** The seat the player flies. null = the player answers every event (Mission Director). */
  playerRole: Role | null
  /** Chosen difficulty: scales the budget and event chances (constants.json "difficulty"). */
  difficulty: Difficulty
}

export type CheckStatus = 'ok' | 'warn' | 'fail'

export type CheckId =
  | 'mass'
  | 'budget'
  | 'power'
  | 'battery'
  | 'supplies'
  | 'suits'
  | 'data'
  | 'crew-count'
  | 'habitat'
  | 'supply-feasibility'

/** One line of the Launch Check. */
export interface Check {
  id: CheckId
  label: string
  status: CheckStatus
  /** What the design has. */
  value: number
  /** What it is compared against. */
  limit: number
  unit: string
  /** Plain-English sentence with the numbers, shown to the player. */
  explanation: string
}

/** Sums over the design, computed by budget.computeTotals. */
export interface Totals {
  /** Parts + supplies + crew (with gear). */
  massKg: number
  partsMassKg: number
  suppliesKg: number
  crewMassKg: number
  /** Average generation on day 0: solar (sun, light share, dust) + steady sources. */
  powerGenW: number
  /** Steady generation that works in the dark (e.g. fission). */
  steadyGenW: number
  solarRatedW: number
  powerUseW: number
  /** Parts + rocket + crew salaries, millions USD. */
  costM: number
  dataGenGbPerDay: number
  /** Downlink capacity per surface day. */
  dataReturnGbPerDay: number
  /** Downlink capacity per transit day (fewer contact hours). */
  dataReturnTransitGbPerDay: number
  /** Science per surface day (all parts). */
  sciencePerDay: number
  batteryWh: number
  /** Best water recycler on board, 0-1. */
  waterRecoveryRate: number
  /** Best oxygen system on board, 0-1. */
  oxygenRecoveryRate: number
  suitCount: number
  spareKits: number
  crewCapacity: number
  storageKg: number
  crewCount: number
}

/**
 * Margins as ratios: (available - required) / available.
 * 0 = exactly at the limit, negative = over the limit, 0.2 = 20% headroom.
 */
export interface Margins {
  mass: number
  power: number
  budget: number
  data: number
}

/** Content the engine reads. Same shape as the validated game content. */
export type EngineContent = Pick<
  GameContent,
  | 'constants'
  | 'destinations'
  | 'scenarios'
  | 'crew'
  | 'parts'
  | 'rockets'
  | 'events'
  | 'roles'
  | 'baseSlots'
>

/** Design + content: everything the mission functions need besides the state. */
export interface MissionContext {
  design: Design
  content: EngineContent
}

// ---------------------------------------------------------------------------------------------
// Mission run state
// ---------------------------------------------------------------------------------------------

export interface CrewStatus {
  /** 0-100. Spent on actions, recovered when not busy. */
  energy: number
  /** 0-100. Low morale cuts science. */
  morale: number
  /** 0-100. 0 ends the mission. */
  health: number
  /** Turns left on a task; busy crew do not recover energy. */
  busyTurns: number
}

export interface MissionResources extends Record<ResourceKey, number> {
  /** Net power last turn (generation − use), W. Information only. */
  power: number
  /**
   * Science points whose data is still onboard. They only move to sciencePoints when the
   * data reaches Earth, and are lost with lost data. sciencePoints = credited (returned) points.
   */
  pendingSciencePoints: number
}

export type ChangeSource = 'consumption' | 'event' | 'option' | 'failure' | 'design'

/** One recorded change to a resource, modifier or crew stat. */
export interface ChangeRecord {
  turn: number
  day: number
  /** Resource key, modifier key, "dataLostGb", "health:<crewId>", "part:<category>", ... */
  resource: string
  delta: number
  sourceType: ChangeSource
  /** "life-support", "power-balance", an event id, "<eventId>:<optionId>", ... */
  sourceId: string
  note: string
}

/** One answered event (by the player, an AI teammate or standing orders). */
export interface DecisionRecord {
  turn: number
  day: number
  eventId: string
  optionId: string
  crewId: string | null
  success: boolean
  chance: number
  /** Energy of the acting crew member before acting (fatigue analysis). */
  crewEnergy: number | null
  handledBy: 'player' | 'ai' | 'standing-orders'
}

/** Compact per-turn snapshot (numbers only) for the debrief and cause analysis. */
export interface TurnSnapshot {
  turn: number
  /** Day the turn started. */
  day: number
  days: number
  phaseId: string
  location: Location
  resources: Record<string, number>
  /** crewId -> [energy, morale, health] at the end of the turn. */
  crew: Record<string, [number, number, number]>
  /** Events that fired this turn. */
  eventIds: string[]
  disabledParts: string[]
  dataLostGb: number
  batteryEmpty: boolean
  scienceShed: boolean
  lifeSupportDegraded: boolean
  rationing: boolean
}

export type MissionFailure =
  | { kind: 'supply'; resource: 'oxygen' | 'food' | 'water'; day: number }
  | { kind: 'crew-health'; crewId: string; day: number }

/** A temporary multiplier from an event (e.g. solarOutput × 0.3 for 2 turns). */
export interface ActiveEffect {
  target: ModifierKey
  value: number
  turnsLeft: number
  sourceEventId: string
}

export type LogKind = 'info' | 'warning' | 'alarm' | 'science' | 'event' | 'decision'

export interface LogEntry {
  turnIndex?: number
  day: number
  kind: LogKind
  text: string
  eventId?: string
  /** Who answered an event: the player, an AI teammate, or standing orders under signal delay. */
  handledBy?: 'player' | 'ai' | 'standing-orders'
}

export interface PendingEvent {
  /** Unique per firing: eventId@turnIndex. */
  uid: string
  eventId: string
  turnIndex: number
  day: number
}

export type MissionOutcome = null | 'success' | 'partial' | 'failed'

export interface MissionState {
  seed: number
  destinationId: string
  /** Next turn to simulate (0-based). Equals totalTurns when the mission is over. */
  turnIndex: number
  totalTurns: number
  /** Days elapsed since launch. */
  day: number
  phaseId: string
  location: Location
  resources: MissionResources
  crew: Record<string, CrewStatus>
  /** partId -> turns until it comes back online. */
  disabledParts: Record<string, number>
  activeEffects: ActiveEffect[]
  eventLog: LogEntry[]
  pendingEvents: PendingEvent[]
  /** eventId -> how often it fired and when it last fired. */
  eventHistory: Record<string, { count: number; lastTurn: number }>
  /** Share of solar output lost to dust, 0-1. */
  dustLevel: number
  /** Design weaknesses that make matching events more likely. */
  weaknesses: Weakness[]
  /** Last turn's average generation and use, W (for powerMarginBelow). */
  lastPower: { genW: number; useW: number }
  /** True after the crew cut the surface stay short (standing order abort_early). */
  abortedEarly: boolean
  /** NOVA hints on (from the difficulty level). */
  hintsEnabled: boolean
  outcome: MissionOutcome
  failReason?: string
  /** Structured version of failReason for cause analysis. */
  failure?: MissionFailure
  turnHistory: TurnSnapshot[]
  changes: ChangeRecord[]
  decisions: DecisionRecord[]
}
