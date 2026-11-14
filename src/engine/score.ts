/**
 * Debrief score. Four parts (science, safety, efficiency, teamwork), each 0-100 with a one-line
 * explanation, weighted by constants.scoring.weights, plus bonus objectives.
 * Pure and deterministic: same final state -> same score (CLAUDE.md rule 1).
 */
import type { BonusObjective } from '@/schemas'
import { computeMargins, computeTotals, resolveDesign } from './budget'
import { fmt, fmtPct } from './format'
import { bestStat, clamp, designParts } from './missionHelpers'
import { daysOfSupply } from './physics'
import type { Design, EngineContent, MissionState } from './types'

export interface ScorePart {
  score: number
  explanation: string
}

export interface BonusResult {
  id: string
  label: string
  achieved: boolean
  points: number
}

export interface MissionScore {
  /** 0-100, rounded. A failed mission is capped at scoring.failedCap. */
  total: number
  stars: 0 | 1 | 2 | 3
  outcome: 'success' | 'partial' | 'failed'
  parts: { science: ScorePart; safety: ScorePart; efficiency: ScorePart; teamwork: ScorePart }
  bonusObjectives: BonusResult[]
  bonusPoints: number
}

export interface ScoreOptions {
  /** Successful negotiated trades with AI teammates (Planning Board). */
  tradesCount?: number
}

/** Facts derived from the history, shared by score and causes. */
export function missionFacts(s: MissionState) {
  const sum = (pred: (r: MissionState['changes'][number]) => boolean) =>
    s.changes.filter(pred).reduce((acc, r) => acc + r.delta, 0)
  const crew = Object.values(s.crew)
  const moraleSeries = s.turnHistory.map((t) => {
    const values = Object.values(t.crew).map((c) => c[1])
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 100
  })
  return {
    dataLostGb: sum((r) => r.resource === 'dataLostGb'),
    stuckGb: s.resources.dataBacklogGb,
    injuries: s.changes.filter((r) => r.resource.startsWith('health:') && r.delta < 0).length,
    dead: crew.filter((c) => c.health <= 0).length,
    avgHealth: crew.length ? crew.reduce((a, c) => a + c.health, 0) / crew.length : 0,
    avgMorale: moraleSeries.length
      ? moraleSeries.reduce((a, b) => a + b, 0) / moraleSeries.length
      : crew.length
        ? crew.reduce((a, c) => a + c.morale, 0) / crew.length
        : 100,
    minMorale: moraleSeries.length ? Math.min(...moraleSeries) : 100,
  }
}

/** 100 inside the band; ramps 60→100 below it; drops toward 50 above it; 0 when negative. */
export function bandScore(m: number, band: { min: number; max: number }): number {
  if (m < 0) return 0
  if (m < band.min) return 60 + 40 * (band.min > 0 ? m / band.min : 1)
  if (m <= band.max) return 100
  return Math.max(50, 100 - (50 * (m - band.max)) / Math.max(1e-9, 1 - band.max))
}

export function computeScore(
  finalState: MissionState,
  design: Design,
  content: EngineContent,
  options: ScoreOptions = {},
): MissionScore {
  const S = content.constants.scoring
  const C = content.constants
  const ctx = { design, content }
  const { scenario, destination, rocket } = resolveDesign(design, content)
  const totals = computeTotals(design, content)
  const margins = computeMargins(
    totals,
    rocket,
    scenario,
    destination,
    content.constants.difficulty[design.difficulty].budgetMultiplier,
  )
  const facts = missionFacts(finalState)
  const r = finalState.resources

  // Science: only points whose data reached Earth.
  const returned = r.sciencePoints
  const science: ScorePart = {
    score: clamp((returned / scenario.scienceTarget) * 100, 0, 100),
    explanation:
      `Returned ${fmt(returned, 1)} of the ${fmt(scenario.scienceTarget)} target science points to Earth` +
      (facts.stuckGb > 0.05 || facts.dataLostGb > 0.05
        ? `; ${fmt(facts.stuckGb, 1)} GB stuck onboard and ${fmt(facts.dataLostGb, 1)} GB lost did not count.`
        : '.'),
  }

  // Safety: final health, deaths, and days of supplies left.
  const parts = designParts(ctx)
  const alive = Object.values(finalState.crew).filter((c) => c.health > 0).length
  const reserve = daysOfSupply(
    { oxygenKg: r.oxygenKg, foodKg: r.foodKg, waterKg: r.waterKg },
    alive,
    C.perCrewPerDay,
    bestStat(parts, 'waterRecoveryRate'),
    bestStat(parts, 'oxygenRecoveryRate'),
  ).days
  const reservePts = Math.min(
    S.reserveMaxPoints,
    (Number.isFinite(reserve) ? reserve : 0) * S.reservePointsPerDay,
  )
  const safety: ScorePart = {
    score: clamp(facts.avgHealth - facts.dead * S.deathPenalty + reservePts, 0, 100),
    explanation: `Crew health averaged ${fmt(facts.avgHealth)}/100 with ${facts.dead} lost; ${fmt(Number.isFinite(reserve) ? reserve : 0, 1)} days of supplies left (+${fmt(reservePts)}).`,
  }

  // Efficiency: unused budget, mass margin used well, power margin.
  const budgetScore = margins.budget < 0 ? 0 : 50 + 50 * Math.min(1, margins.budget / 0.5)
  const massScore = bandScore(margins.mass, S.massMarginBand)
  const powerScore = bandScore(margins.power, S.powerMarginBand)
  const efficiency: ScorePart = {
    score: (budgetScore + massScore + powerScore) / 3,
    explanation: `${fmtPct(Math.max(0, margins.budget))} of the budget unused (${fmt(budgetScore)}), mass margin ${fmtPct(margins.mass)} (${fmt(massScore)}), power margin ${fmtPct(margins.power)} (${fmt(powerScore)}).`,
  }

  // Teamwork: morale over the mission, conflicts, negotiated trades.
  const conflicts = S.conflictEventIds.reduce(
    (n, id) => n + (finalState.eventHistory[id]?.count ?? 0),
    0,
  )
  const trades = options.tradesCount ?? 0
  const teamwork: ScorePart = {
    score: clamp(facts.avgMorale - conflicts * S.conflictPenalty + trades * S.tradeBonus, 0, 100),
    explanation: `Morale averaged ${fmt(facts.avgMorale)}/100 over the mission, ${conflicts} conflict${conflicts === 1 ? '' : 's'}, ${trades} negotiated trade${trades === 1 ? '' : 's'}.`,
  }

  const bonusObjectives = scenario.bonusObjectives.map((b) => ({
    id: b.id,
    label: b.label,
    points: b.points,
    achieved: bonusAchieved(b, finalState, facts, margins.budget, scenario.scienceTarget),
  }))
  const bonusPoints = bonusObjectives.filter((b) => b.achieved).reduce((a, b) => a + b.points, 0)

  const W = S.weights
  const weighted =
    W.science * science.score +
    W.safety * safety.score +
    W.efficiency * efficiency.score +
    W.teamwork * teamwork.score
  const failed = finalState.outcome === 'failed'
  let total = Math.round(clamp(weighted + bonusPoints, 0, 100))
  if (failed) total = Math.min(total, S.failedCap)
  const outcome = failed
    ? 'failed'
    : total >= S.outcomeThresholds.success
      ? 'success'
      : total >= S.outcomeThresholds.partial
        ? 'partial'
        : 'failed'
  const stars = S.starThresholds.filter((t) => total >= t).length as 0 | 1 | 2 | 3

  return {
    total,
    stars,
    outcome,
    parts: { science, safety, efficiency, teamwork },
    bonusObjectives,
    bonusPoints,
  }
}

function bonusAchieved(
  b: BonusObjective,
  s: MissionState,
  facts: ReturnType<typeof missionFacts>,
  budgetMargin: number,
  scienceTarget: number,
): boolean {
  switch (b.condition) {
    case 'allDataReturned':
      return facts.dataLostGb === 0 && s.resources.dataBacklogGb < 0.01 && s.resources.scienceGb > 0
    case 'noInjuries':
      return facts.injuries === 0
    case 'underBudgetPct':
      return budgetMargin >= (b.value ?? 0) / 100
    case 'scienceAbovePct':
      return s.resources.sciencePoints >= (scienceTarget * (b.value ?? 100)) / 100
    case 'noCrewLost':
      return facts.dead === 0
  }
}
