/**
 * Positive chains for the Failure Review Board: what the design got right.
 */
import type { CauseChain, CauseContext } from './causes'
import { fmt, fmtPct } from './format'
import { lifeSupportNeedKg } from './physics'

const positive = (
  id: string,
  headline: string,
  steps: string[],
  root: CauseChain['rootDesignDecision'],
  suggestion: string,
): CauseChain => ({
  id,
  severity: 'positive',
  headline,
  steps,
  rootDesignDecision: root,
  suggestion,
  impact: { scorePointsLost: 0 },
})

/** A healthy power margin absorbed a power-related event. */
export function detectPowerMarginHeld(c: CauseContext): CauseChain | null {
  if (c.margins.power < 0.3) return null
  if (c.state.turnHistory.some((t) => t.batteryEmpty || t.lifeSupportDegraded || t.scienceShed))
    return null
  const hit = c.state.turnHistory
    .flatMap((t) => t.eventIds.map((id) => ({ id, day: t.day })))
    .find(({ id }) => c.content.events.find((e) => e.id === id)?.weakness === 'power')
  if (!hit) return null
  const title = c.title(hit.id)
  return positive(
    'power-margin-held',
    `Your ${fmtPct(c.margins.power)} power margin turned the ${title} into a non-event`,
    [
      `${title} hit on day ${hit.day}.`,
      `Generation averaged ${fmt(c.totals.powerGenW)} W against a ${fmt(c.totals.powerUseW)} W load, so the batteries never ran empty.`,
    ],
    { field: 'partIds', value: `${fmt(c.totals.powerGenW)} W`, label: 'Power generation' },
    'Keep at least a 30% power margin on the next design.',
  )
}

/** Recycling saved launch mass and the mission did not run out. */
export function detectRecyclingSaved(c: CauseContext): CauseChain | null {
  const w = c.totals.waterRecoveryRate
  const o = c.totals.oxygenRecoveryRate
  if ((w === 0 && o === 0) || c.state.failure?.kind === 'supply') return null
  const crewN = c.design.crewIds.length
  const days = c.state.day
  const raw = lifeSupportNeedKg(crewN, days, c.content.constants.perCrewPerDay, 0, 0)
  const rec = lifeSupportNeedKg(crewN, days, c.content.constants.perCrewPerDay, w, o)
  const saved = raw.water + raw.oxygen - (rec.water + rec.oxygen)
  if (saved < 1) return null
  const steps = [
    `Over ${fmt(days)} days, ${crewN} crew would have used ${fmt(raw.water)} kg of water and ${fmt(raw.oxygen)} kg of oxygen.`,
  ]
  if (w > 0) steps.push(`${fmtPct(w)} water recycling cut that to ${fmt(rec.water)} kg.`)
  if (o > 0) steps.push(`${fmtPct(o)} oxygen recovery cut oxygen to ${fmt(rec.oxygen)} kg.`)
  return positive(
    'recycling-saved',
    `Recycling saved ${fmt(saved)} kg of water and oxygen`,
    steps,
    {
      field: 'partIds',
      value: `${fmtPct(w)} water / ${fmtPct(o)} O2`,
      label: 'Life support recycling',
    },
    'Keep the recyclers, and pack a little contingency water for outages.',
  )
}

/** Every gigabyte reached Earth. */
export function detectDataAllHome(c: CauseContext): CauseChain | null {
  if (c.state.resources.scienceGb <= 0 || c.facts.dataLostGb > 0 || c.facts.stuckGb > 0.01)
    return null
  return positive(
    'data-all-home',
    'Every gigabyte made it home',
    [
      `${fmt(c.state.resources.scienceGb, 1)} GB of science data reached Earth with nothing lost.`,
      `Instruments made ${fmt(c.totals.dataGenGbPerDay, 1)} GB/day and the links could send ${fmt(c.totals.dataReturnGbPerDay, 1)} GB/day.`,
    ],
    {
      field: 'partIds',
      value: `${fmt(c.totals.dataReturnGbPerDay, 1)} GB/day`,
      label: 'Comms system',
    },
    'Your comms have spare capacity: you could fly a more data-hungry instrument.',
  )
}

/** One Leader, a Thinker and a Practical: morale held. */
export function detectBalancedTeam(c: CauseContext): CauseChain | null {
  const leaders = c.crew.filter((m) => m.traits.includes('leader')).length
  const thinker = c.crew.some((m) => m.traits.includes('thinker'))
  const practical = c.crew.some((m) => m.traits.includes('practical'))
  if (
    leaders !== 1 ||
    !thinker ||
    !practical ||
    c.facts.minMorale < c.content.constants.mission.lowMoraleThreshold
  )
    return null
  return positive(
    'balanced-team',
    `A balanced crew kept morale above ${fmt(c.facts.minMorale)}`,
    [
      'One Leader, at least one Thinker and at least one Practical: no team-balance penalties applied.',
      `Morale averaged ${fmt(c.facts.avgMorale)}/100 over the mission.`,
    ],
    { field: 'crewIds', value: c.design.crewIds.join(', '), label: 'Crew recruited' },
    'Keep this mix of traits when you recruit.',
  )
}
