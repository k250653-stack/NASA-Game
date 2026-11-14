/**
 * Failure Review Board brain: turns a finished mission into short cause -> effect chains, each
 * traced back to one design decision with a concrete fix. Pure and deterministic.
 *
 * To add a detector: write `(c: CauseContext) => CauseChain | null` in causeDetectors.ts (or
 * causePositives.ts) and add it to DETECTORS below with a unique id. Nothing else changes.
 */
import type { CrewMember, Destination, Part, Scenario } from '@/schemas'
import { computeMargins, computeTotals, resolveDesign } from './budget'
import {
  detectDataLoss,
  detectEvaImpossible,
  detectMoraleCollapse,
  detectPowerShortfall,
  detectRepairFailures,
  detectSupplyRunOut,
} from './causeDetectors'
import {
  detectBalancedTeam,
  detectDataAllHome,
  detectPowerMarginHeld,
  detectRecyclingSaved,
} from './causePositives'
import { crewMembers, designParts } from './missionHelpers'
import { computeScore, missionFacts, type MissionScore, type ScoreOptions } from './score'
import { totalMissionDays } from './timeline'
import type { Design, EngineContent, Margins, MissionState, Totals } from './types'

export type CauseSeverity = 'critical' | 'major' | 'minor' | 'positive'

export interface CauseChain {
  /** Detector id that produced it. */
  id: string
  severity: CauseSeverity
  headline: string
  /** Short cause -> effect sentences with numbers. */
  steps: string[]
  /** The design choice at the root of the chain. */
  rootDesignDecision: { field: string; value: string | number; label: string }
  /** Concrete redesign tip for the replay screen. */
  suggestion: string
  impact: { scorePointsLost: number }
}

/** Everything a detector may read. Built once per analysis. */
export interface CauseContext {
  state: MissionState
  design: Design
  content: EngineContent
  totals: Totals
  margins: Margins
  destination: Destination
  scenario: Scenario
  missionDays: number
  parts: Part[]
  crew: CrewMember[]
  score: MissionScore
  facts: ReturnType<typeof missionFacts>
  /** Event title by id. */
  title: (eventId: string) => string
}

export type Detector = (c: CauseContext) => CauseChain | null

/** Every detector, in a fixed order (determinism). Add new ones here. */
export const DETECTORS: ReadonlyArray<{ id: string; detect: Detector }> = [
  { id: 'supply-ran-out', detect: detectSupplyRunOut },
  { id: 'power-shortfall', detect: detectPowerShortfall },
  { id: 'data-lost', detect: detectDataLoss },
  { id: 'repair-failures', detect: detectRepairFailures },
  { id: 'morale-collapse', detect: detectMoraleCollapse },
  { id: 'eva-impossible', detect: detectEvaImpossible },
  { id: 'power-margin-held', detect: detectPowerMarginHeld },
  { id: 'recycling-saved', detect: detectRecyclingSaved },
  { id: 'data-all-home', detect: detectDataAllHome },
  { id: 'balanced-team', detect: detectBalancedTeam },
]

export function buildCauseContext(
  state: MissionState,
  design: Design,
  content: EngineContent,
  options: ScoreOptions = {},
): CauseContext {
  const { destination, scenario, rocket } = resolveDesign(design, content)
  const totals = computeTotals(design, content)
  const ctx = { design, content }
  return {
    state,
    design,
    content,
    totals,
    margins: computeMargins(totals, rocket, scenario, destination),
    destination,
    scenario,
    missionDays: totalMissionDays(destination),
    parts: designParts(ctx),
    crew: crewMembers(ctx),
    score: computeScore(state, design, content, options),
    facts: missionFacts(state),
    title: (id) => content.events.find((e) => e.id === id)?.title ?? id,
  }
}

const SEVERITY_ORDER: Record<CauseSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  positive: 3,
}

/** Severity first, then biggest impact; ties keep detector order. */
export function sortCauses(chains: readonly CauseChain[]): CauseChain[] {
  return chains
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.c.severity] - SEVERITY_ORDER[b.c.severity] ||
        b.c.impact.scorePointsLost - a.c.impact.scorePointsLost ||
        a.i - b.i,
    )
    .map((x) => x.c)
}

/** At most `max` chains; if any positive chain exists, at least one is kept. */
export function selectCauses(chains: readonly CauseChain[], max = 5): CauseChain[] {
  const sorted = sortCauses(chains)
  const negatives = sorted.filter((c) => c.severity !== 'positive')
  const positives = sorted.filter((c) => c.severity === 'positive')
  const shownNegatives = negatives.slice(0, positives.length > 0 ? max - 1 : max)
  return [...shownNegatives, ...positives.slice(0, max - shownNegatives.length)]
}

/** All detector results, unsorted and unlimited (for tests and tooling). */
export function runDetectors(c: CauseContext): CauseChain[] {
  return DETECTORS.map((d) => d.detect(c)).filter((x): x is CauseChain => x !== null)
}

/** The chains the Failure Review Board shows: sorted, max 5, at least one positive if any. */
export function analyzeCauses(
  finalState: MissionState,
  design: Design,
  content: EngineContent,
  options: ScoreOptions = {},
): CauseChain[] {
  return selectCauses(runDetectors(buildCauseContext(finalState, design, content, options)))
}
