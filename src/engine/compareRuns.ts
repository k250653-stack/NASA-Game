/**
 * Compares two runs for the replay screen: what changed in the design and how each score part
 * moved. Pure TypeScript (CLAUDE.md rule 1).
 */
import type { MissionScore } from './score'
import type { Design, EngineContent } from './types'

export interface RunRecord {
  design: Design
  score: MissionScore
}

export interface DesignChange {
  /** e.g. "rocketId", "supplies.foodKg", "partIds", "crewIds", "standingOrders.eva" */
  field: string
  label: string
  before: string
  after: string
}

export interface RunComparison {
  designChanges: DesignChange[]
  scoreDeltas: {
    total: number
    science: number
    safety: number
    efficiency: number
    teamwork: number
    bonus: number
  }
  starsDelta: number
  outcome: { before: MissionScore['outcome']; after: MissionScore['outcome'] }
}

function counts(ids: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1))
  return m
}

/** Diff of design decisions (A -> B) and score part deltas (B − A). Names come from content if given. */
export function compareRuns(
  runA: RunRecord,
  runB: RunRecord,
  content?: EngineContent,
): RunComparison {
  const a = runA.design
  const b = runB.design
  const name = (
    kind: 'parts' | 'rockets' | 'crew' | 'destinations' | 'scenarios',
    id: string | null,
  ) => (id === null ? 'none' : (content?.[kind].find((x) => x.id === id)?.name ?? id))
  const changes: DesignChange[] = []
  const push = (field: string, label: string, before: string, after: string) => {
    if (before !== after) changes.push({ field, label, before, after })
  }

  push(
    'destinationId',
    'Destination',
    name('destinations', a.destinationId),
    name('destinations', b.destinationId),
  )
  push('scenarioId', 'Scenario', name('scenarios', a.scenarioId), name('scenarios', b.scenarioId))
  push('rocketId', 'Launcher', name('rockets', a.rocketId), name('rockets', b.rocketId))
  push('playerRole', 'Your role', a.playerRole ?? 'all', b.playerRole ?? 'all')
  for (const key of ['oxygenKg', 'foodKg', 'waterKg'] as const) {
    push(
      `supplies.${key}`,
      `${key.replace('Kg', '')} packed (kg)`,
      String(a.supplies[key]),
      String(b.supplies[key]),
    )
  }
  for (const key of Object.keys(a.standingOrders) as Array<keyof Design['standingOrders']>) {
    push(
      `standingOrders.${key}`,
      `Standing order: ${key}`,
      a.standingOrders[key],
      b.standingOrders[key],
    )
  }

  const pa = counts(a.partIds)
  const pb = counts(b.partIds)
  for (const id of [...new Set([...a.partIds, ...b.partIds])]) {
    push('partIds', name('parts', id), `${pa.get(id) ?? 0}×`, `${pb.get(id) ?? 0}×`)
  }
  const ca = new Set(a.crewIds)
  const cb = new Set(b.crewIds)
  for (const id of [...new Set([...a.crewIds, ...b.crewIds])]) {
    push(
      'crewIds',
      name('crew', id),
      ca.has(id) ? 'recruited' : 'not recruited',
      cb.has(id) ? 'recruited' : 'not recruited',
    )
  }

  const pA = runA.score.parts
  const pB = runB.score.parts
  return {
    designChanges: changes,
    scoreDeltas: {
      total: runB.score.total - runA.score.total,
      science: pB.science.score - pA.science.score,
      safety: pB.safety.score - pA.safety.score,
      efficiency: pB.efficiency.score - pA.efficiency.score,
      teamwork: pB.teamwork.score - pA.teamwork.score,
      bonus: runB.score.bonusPoints - runA.score.bonusPoints,
    },
    starsDelta: runB.score.stars - runA.score.stars,
    outcome: { before: runA.score.outcome, after: runB.score.outcome },
  }
}
