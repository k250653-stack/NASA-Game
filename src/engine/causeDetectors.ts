/**
 * Problem detectors for the Failure Review Board. Each returns one CauseChain or null.
 * Steps are short sentences with numbers; the root is a design decision; the suggestion is a fix.
 */
import type { CauseChain, CauseContext } from './causes'
import { isEvaOption } from './events'
import { fmt, fmtPct } from './format'
import { dataReturnedGbPerDay } from './physics'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const unique = (xs: string[]) => [...new Set(xs)]
const listNames = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** 1. A supply ran out: which, when, packed vs needed, and what mass it was traded for. */
export function detectSupplyRunOut(c: CauseContext): CauseChain | null {
  const f = c.state.failure
  if (f?.kind !== 'supply') return null
  const key = `${f.resource}Kg` as 'oxygenKg' | 'foodKg' | 'waterKg'
  const per = c.content.constants.perCrewPerDay[key]
  const recovery =
    f.resource === 'water'
      ? c.totals.waterRecoveryRate
      : f.resource === 'oxygen'
        ? c.totals.oxygenRecoveryRate
        : 0
  const crewN = c.design.crewIds.length
  const dailyKg = crewN * per * (1 - recovery)
  const packed = c.design.supplies[key]
  const packedDays = dailyKg > 0 ? packed / dailyKg : Infinity
  const needed = c.missionDays + c.content.constants.reserveDaysRequired.value

  const steps = [
    `${cap(f.resource)} ran out on day ${f.day}.`,
    `You packed ${fmt(packedDays, 1)} days of ${f.resource} for ${crewN} crew (${fmt(packed)} kg); the mission needed ${fmt(needed)} days.`,
  ]
  const eventLoss = -c.state.changes
    .filter(
      (r) =>
        r.resource === key &&
        (r.sourceType === 'event' || r.sourceType === 'option') &&
        r.delta < 0,
    )
    .reduce((a, r) => a + r.delta, 0)
  if (eventLoss > 0.5) {
    const titles = unique(
      c.state.changes
        .filter((r) => r.resource === key && r.sourceType === 'event' && r.delta < 0)
        .map((r) => c.title(r.sourceId)),
    )
    steps.push(
      `Events cost another ${fmt(eventLoss)} kg of ${f.resource}${titles.length ? ` (${listNames(titles)})` : ''}.`,
    )
  }
  const lifeSupportIds = new Set(
    c.parts.filter((p) => p.category === 'life_support').map((p) => p.id),
  )
  const outage = c.state.turnHistory.filter((t) =>
    t.disabledParts.some((id) => lifeSupportIds.has(id)),
  )
  if (f.resource !== 'food' && outage.length > 0) {
    steps.push(
      `Recyclers were offline for ${outage.length} turn(s), ${fmt(outage.reduce((a, t) => a + t.days, 0))} days of full ${f.resource} use.`,
    )
  }
  const optional = [...c.parts]
    .filter((p) => p.category === 'instrument' || p.category === 'rover')
    .sort((a, b) => b.massKg - a.massKg)[0]
  const recycler = [...c.content.parts]
    .filter((p) =>
      f.resource === 'water'
        ? p.stats.waterRecoveryRate
        : f.resource === 'oxygen'
          ? p.stats.oxygenRecoveryRate
          : 0,
    )
    .sort((a, b) => a.massKg - b.massKg)[0]
  if (optional && dailyKg > 0) {
    steps.push(
      `The ${optional.name} (+${fmt(optional.massKg)} kg) took mass that could have carried ${fmt(optional.massKg / dailyKg, 1)} more days of ${f.resource}.`,
    )
  } else if (recovery === 0 && f.resource !== 'food') {
    steps.push(`No ${f.resource} recycler was on board, so every kilogram had to be launched.`)
  }

  const moreDays = Math.max(1, Math.ceil(needed - f.day))
  const recyclerRate = recycler
    ? ((f.resource === 'water'
        ? recycler.stats.waterRecoveryRate
        : recycler.stats.oxygenRecoveryRate) ?? 0)
    : 0
  const packMore = `${moreDays} more days of ${f.resource} (+${fmt(moreDays * dailyKg)} kg)`
  // With no recycler on board, recycling is the bigger lever, so suggest it first.
  const suggestion =
    recovery === 0 && recycler
      ? `Add the ${recycler.name} (−${fmtPct(recyclerRate)} ${f.resource} use) or pack ${packMore}.`
      : `Pack ${packMore}.`
  return {
    id: 'supply-ran-out',
    severity: 'critical',
    headline: `${cap(f.resource)} ran out on day ${f.day}`,
    steps,
    rootDesignDecision: {
      field: `supplies.${key}`,
      value: packed,
      label: `${cap(f.resource)} packed`,
    },
    suggestion,
    impact: { scorePointsLost: 100 - c.score.total },
  }
}

/** 2. Power shortfall: empty batteries, the dark period, capacity vs need, generation. */
export function detectPowerShortfall(c: CauseContext): CauseChain | null {
  const short = c.state.turnHistory.filter(
    (t) => t.batteryEmpty || t.lifeSupportDegraded || t.scienceShed,
  )
  if (short.length === 0) return null
  const first = short[0]!
  const degraded = short.filter((t) => t.lifeSupportDegraded).length
  const shed = short.filter((t) => t.scienceShed).length
  const darkLoad = Math.max(0, c.totals.powerUseW - c.totals.steadyGenW)
  const need = darkLoad * c.destination.darkPeriodHours
  const batteryShort = c.totals.batteryWh < need
  const steps = [
    `Batteries ran empty on day ${first.day} (${short.length} turn(s) short of power).`,
  ]
  if (need > 0) {
    steps.push(
      `The longest dark period is ${fmt(c.destination.darkPeriodHours)} h: at ${fmt(darkLoad)} W that needs ${fmt(need)} Wh, and you carried ${fmt(c.totals.batteryWh)} Wh.`,
    )
  }
  steps.push(
    `Average generation was ${fmt(c.totals.powerGenW)} W against a ${fmt(c.totals.powerUseW)} W load (${fmtPct(c.margins.power)} margin).`,
  )
  const solarHits = unique(
    c.state.changes
      .filter((r) => r.resource === 'solarOutput' && r.delta < 0)
      .map((r) => c.title(r.sourceId)),
  )
  if (solarHits.length) steps.push(`${listNames(solarHits)} cut solar output further.`)
  if (shed) steps.push(`Science instruments were switched off for ${shed} turn(s).`)
  const healthLost = -c.state.changes
    .filter((r) => r.sourceId === 'power-shortfall')
    .reduce((a, r) => a + r.delta, 0)
  if (degraded)
    steps.push(
      `Life support ran degraded for ${degraded} turn(s): the crew lost ${fmt(healthLost)} health points in total.`,
    )

  const battery = [...c.content.parts]
    .filter((p) => p.category === 'battery')
    .sort((a, b) => (b.stats.capacityWh ?? 0) / b.massKg - (a.stats.capacityWh ?? 0) / a.massKg)[0]
  const solar = [...c.content.parts]
    .filter((p) => p.stats.ratedPowerW)
    .sort(
      (a, b) => (b.stats.ratedPowerW ?? 0) / b.massKg - (a.stats.ratedPowerW ?? 0) / a.massKg,
    )[0]
  const packs = battery
    ? Math.max(1, Math.ceil((need - c.totals.batteryWh) / (battery.stats.capacityWh ?? 1)))
    : 1
  const W = c.content.constants.scoring.weights
  const turns = Math.max(1, c.state.totalTurns)
  return {
    id: 'power-shortfall',
    severity:
      c.state.failure?.kind === 'crew-health' && degraded
        ? 'critical'
        : degraded
          ? 'major'
          : 'minor',
    headline: `Power ran short from day ${first.day}`,
    steps,
    rootDesignDecision: batteryShort
      ? { field: 'partIds', value: `${fmt(c.totals.batteryWh)} Wh`, label: 'Battery capacity' }
      : { field: 'partIds', value: `${fmt(c.totals.powerGenW)} W`, label: 'Power generation' },
    suggestion:
      batteryShort && battery
        ? `Add ${packs} × ${battery.name} (+${fmt(packs * battery.massKg)} kg) to cover the ${fmt(need)} Wh night.`
        : `Add the ${solar?.name ?? 'a larger array'} or cut steady loads to restore a ${fmtPct(c.content.constants.powerMarginTarget.value)} power margin.`,
    impact: {
      scorePointsLost: Math.round(
        W.science * 100 * (shed / turns) + (W.safety * healthLost) / Math.max(1, c.crew.length),
      ),
    },
  }
}

/** 3. Data lost or stuck: link rate × contact hours vs data generated. */
export function detectDataLoss(c: CauseContext): CauseChain | null {
  const lost = c.facts.dataLostGb
  const stuck = c.facts.stuckGb
  const total = c.state.resources.scienceGb + lost + stuck
  if (total <= 0 || (lost + stuck) / total < 0.05) return null
  const comms = c.parts.filter((p) => p.stats.dataRateMbps)
  const rate = comms.reduce((a, p) => a + (p.stats.dataRateMbps ?? 0), 0)
  const perDay = dataReturnedGbPerDay(rate, c.destination.contactHoursPerDay)
  const names = unique(comms.map((p) => p.name))
  const steps = [
    `${fmt(lost, 1)} GB of science data was lost and ${fmt(stuck, 1)} GB never left the base (${fmtPct((lost + stuck) / total)} of everything collected).`,
    `Your comms (${names.length ? listNames(names) : 'none'}) send ${fmt(rate, 1)} Mbps × ${fmt(c.destination.contactHoursPerDay)} h = ${fmt(perDay, 1)} GB/day on the surface, but instruments made ${fmt(c.totals.dataGenGbPerDay, 1)} GB/day.`,
  ]
  if (lost > 0)
    steps.push(
      `Onboard storage holds only ${fmt(c.content.constants.mission.dataStorageGb)} GB, so the overflow was deleted.`,
    )
  const hits = unique(
    c.state.changes
      .filter((r) => r.resource === 'dataRate' && r.delta < 0)
      .map((r) => c.title(r.sourceId)),
  )
  if (hits.length) steps.push(`${listNames(hits)} cut the data rate further.`)
  const better = [...c.content.parts]
    .filter((p) => (p.stats.dataRateMbps ?? 0) > rate)
    .sort((a, b) => (a.stats.dataRateMbps ?? 0) - (b.stats.dataRateMbps ?? 0))[0]
  const hungriest = [...c.parts].sort(
    (a, b) => (b.stats.scienceDataGbPerDay ?? 0) - (a.stats.scienceDataGbPerDay ?? 0),
  )[0]
  const lostPoints =
    -c.state.changes
      .filter((r) => r.resource === 'pendingSciencePoints' && r.delta < 0)
      .reduce((a, r) => a + r.delta, 0) + c.state.resources.pendingSciencePoints
  return {
    id: 'data-lost',
    severity: (lost + stuck) / total > 0.25 ? 'major' : 'minor',
    headline: `${fmtPct((lost + stuck) / total)} of the science data never reached Earth`,
    steps,
    rootDesignDecision: {
      field: 'partIds',
      value: names.join(', ') || 'none',
      label: 'Comms system',
    },
    suggestion: better
      ? `Swap to the ${better.name} (${fmt(better.stats.dataRateMbps ?? 0)} Mbps = ${fmt(dataReturnedGbPerDay(better.stats.dataRateMbps ?? 0, c.destination.contactHoursPerDay), 1)} GB/day).`
      : `Drop the ${hungriest?.name ?? 'most data-hungry instrument'} (−${fmt(hungriest?.stats.scienceDataGbPerDay ?? 0, 1)} GB/day) or add a second antenna.`,
    impact: {
      scorePointsLost: Math.round(
        c.content.constants.scoring.weights.science *
          100 *
          Math.min(1, lostPoints / c.scenario.scienceTarget),
      ),
    },
  }
}

/** 4. Repairs failed or were impossible: no Practical crew, fatigue, or spare kits ran out. */
export function detectRepairFailures(c: CauseContext): CauseChain | null {
  const isRepair = (eventId: string, optionId: string) =>
    c.content.events
      .find((e) => e.id === eventId)
      ?.options.find((o) => o.id === optionId)
      ?.tags.includes('repair') ?? false
  const failed = c.state.decisions.filter((d) => !d.success && isRepair(d.eventId, d.optionId))
  const sparesOutAt = c.state.turnHistory.find((t) => (t.resources.spareKits ?? 0) < 1)
  const blocked = sparesOutAt
    ? c.state.turnHistory
        .filter((t) => t.turn > sparesOutAt.turn)
        .flatMap((t) => t.eventIds)
        .filter((id) =>
          c.content.events
            .find((e) => e.id === id)
            ?.options.some((o) => (o.consumes.spareKits ?? 0) > 0),
        )
    : []
  if (failed.length === 0 && blocked.length === 0) return null
  const noPractical = !c.crew.some((m) => m.traits.includes('practical'))
  // Spares only explain the problem if a failed repair needed them or a later fault went unfixed.
  const usesSpares = (eventId: string, optionId: string) =>
    (c.content.events.find((e) => e.id === eventId)?.options.find((o) => o.id === optionId)
      ?.consumes.spareKits ?? 0) > 0
  const sparesMatter =
    sparesOutAt !== undefined &&
    (blocked.length > 0 || failed.some((d) => usesSpares(d.eventId, d.optionId)))
  const tired = failed.filter((d) => d.crewEnergy !== null && d.crewEnergy < 40)
  const steps: string[] = []
  if (failed.length) {
    steps.push(
      `${failed.length} repair(s) failed: ${listNames(unique(failed.map((d) => c.title(d.eventId))))}.`,
    )
    steps.push(
      `Their success chance averaged ${fmtPct(failed.reduce((a, d) => a + d.chance, 0) / failed.length)}.`,
    )
  }
  if (noPractical)
    steps.push(
      'Nobody on the crew is Practical: no +10% on technical repairs, and the team takes a −25% repair penalty.',
    )
  for (const d of tired.slice(0, 2)) {
    const name = c.crew.find((m) => m.id === d.crewId)?.name ?? 'A crew member'
    steps.push(
      `${name} attempted ${c.title(d.eventId)} at ${fmt(d.crewEnergy ?? 0)} energy (fatigue cut the odds).`,
    )
  }
  if (sparesMatter && sparesOutAt)
    steps.push(
      `Spare kits ran out on day ${sparesOutAt.day}; you packed ${fmt(c.totals.spareKits)}${blocked.length ? `, and ${blocked.length} later fault(s) could not be fixed with spares` : ''}.`,
    )

  const practical = c.content.crew.find(
    (m) => m.traits.includes('practical') && !c.design.crewIds.includes(m.id),
  )
  const crate = [...c.content.parts]
    .filter((p) => p.stats.spareKits)
    .sort((a, b) => (b.stats.spareKits ?? 0) - (a.stats.spareKits ?? 0))[0]
  const root = noPractical
    ? { field: 'crewIds', value: c.design.crewIds.join(', '), label: 'Crew recruited' }
    : sparesMatter
      ? { field: 'partIds', value: c.totals.spareKits, label: 'Spare kits packed' }
      : { field: 'crewIds', value: c.design.crewIds.join(', '), label: 'Crew workload' }
  const suggestion = noPractical
    ? `Recruit a Practical crew member${practical ? ` such as ${practical.name}` : ''} to lift repair odds.`
    : sparesMatter
      ? `Pack the ${crate?.name ?? 'spares crate'} (+${fmt(crate?.stats.spareKits ?? 3)} kits, +${fmt(crate?.massKg ?? 0)} kg).`
      : 'Rest tired crew before repairs: fatigue costs up to 20% success chance.'
  const n = failed.length + blocked.length
  return {
    id: 'repair-failures',
    severity: n >= 2 ? 'major' : 'minor',
    headline: failed.length
      ? `${failed.length} repair${failed.length === 1 ? '' : 's'} failed`
      : `Spare kits ran out with ${blocked.length} fault(s) left`,
    steps,
    rootDesignDecision: root,
    suggestion,
    impact: { scorePointsLost: 3 * n },
  }
}

/** 5. Morale collapse: too many or no leaders, conflicts, rationing. */
export function detectMoraleCollapse(c: CauseContext): CauseChain | null {
  const threshold = c.content.constants.mission.lowMoraleThreshold
  const series = c.state.turnHistory.map((t) => {
    const v = Object.values(t.crew).map((x) => x[1])
    return {
      day: t.day + t.days,
      avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 100,
      rationing: t.rationing,
    }
  })
  const low = series.find((p) => p.avg < threshold)
  if (!low) return null
  const leaders = c.crew.filter((m) => m.traits.includes('leader'))
  const rules = c.content.constants.teamRules
  const conflicts = c.content.constants.scoring.conflictEventIds.reduce(
    (n, id) => n + (c.state.eventHistory[id]?.count ?? 0),
    0,
  )
  const rationTurns = series.filter((p) => p.rationing).length
  const steps = [
    `Average morale fell to ${fmt(Math.min(...series.map((p) => p.avg)))} (below ${threshold}) by day ${low.day}.`,
  ]
  if (leaders.length >= 2) {
    steps.push(
      `${listNames(leaders.map((m) => m.name))} are all Leaders: arguing drains ${Math.abs(rules.multiLeaderMoraleDrift)} morale every turn (${series.length} turns = −${Math.abs(rules.multiLeaderMoraleDrift) * series.length}).`,
    )
  } else if (leaders.length === 0) {
    steps.push('Nobody on the crew is a Leader, so the team had no one to rally it.')
  }
  if (conflicts) steps.push(`${conflicts} crew argument(s) broke out.`)
  if (rationTurns)
    steps.push(
      `Food rationing cost ${Math.abs(c.content.constants.mission.rationMoralePerTurn)} morale per turn for ${rationTurns} turn(s).`,
    )
  const swap = leaders[leaders.length - 1]
  return {
    id: 'morale-collapse',
    severity: 'major',
    headline: `Morale collapsed by day ${low.day}`,
    steps,
    rootDesignDecision:
      leaders.length === 1 && rationTurns
        ? { field: 'supplies.foodKg', value: c.design.supplies.foodKg, label: 'Food packed' }
        : { field: 'crewIds', value: c.design.crewIds.join(', '), label: 'Crew recruited' },
    suggestion:
      leaders.length >= 2
        ? `Recruit only one Leader: swap ${swap?.name ?? 'one of them'} for a Thinker or Practical crew member.`
        : leaders.length === 0
          ? 'Recruit one Leader to steady the team.'
          : 'Pack enough food to avoid rationing.',
    impact: {
      scorePointsLost: Math.round(
        c.content.constants.scoring.weights.teamwork * (100 - c.facts.avgMorale),
      ),
    },
  }
}

/** 6. EVA impossible: events needed someone outside but no suits were available. */
export function detectEvaImpossible(c: CauseContext): CauseChain | null {
  const needed = c.state.turnHistory.flatMap((t) =>
    (t.resources.suits ?? 0) < 1
      ? t.eventIds.filter((id) =>
          c.content.events.find((e) => e.id === id)?.options.some(isEvaOption),
        )
      : [],
  )
  if (needed.length === 0) return null
  const settled = unique(
    c.state.decisions
      .filter((d) => needed.includes(d.eventId))
      .map(
        (d) =>
          c.content.events.find((e) => e.id === d.eventId)?.options.find((o) => o.id === d.optionId)
            ?.label ?? d.optionId,
      ),
  )
  const pair = [...c.content.parts]
    .filter((p) => p.stats.suitCount)
    .sort((a, b) => (b.stats.suitCount ?? 0) - (a.stats.suitCount ?? 0))[0]
  const steps = [
    `${needed.length} event(s) needed someone outside but no suits were available (${listNames(unique(needed.map(c.title)))}).`,
    `You packed ${fmt(c.totals.suitCount)} EVA suit(s).`,
  ]
  if (settled.length)
    steps.push(`The crew had to settle for: ${listNames(settled.map((s) => `"${s}"`))}.`)
  return {
    id: 'eva-impossible',
    severity: 'major',
    headline: 'EVA was impossible when it mattered',
    steps,
    rootDesignDecision: { field: 'partIds', value: c.totals.suitCount, label: 'EVA suits packed' },
    suggestion: `Pack the ${pair?.name ?? 'EVA suit pair'} (+${fmt(pair?.massKg ?? 0)} kg) so two crew can always go outside.`,
    impact: { scorePointsLost: 4 * needed.length },
  }
}
