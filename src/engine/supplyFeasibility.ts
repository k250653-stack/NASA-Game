/**
 * "Supply mass feasibility": with the recyclers on board, can the rocket carry the dry
 * payload plus every kg of consumables the whole mission needs? Also explains, in numbers,
 * how much recycling saves. Pure TypeScript (CLAUDE.md rule 1).
 */
import type { PerCrewPerDay } from '@/schemas'
import { fmt, fmtPct } from './format'
import { lifeSupportNeedKg } from './physics'
import type { Check, Totals } from './types'

export function supplyFeasibilityCheck(
  t: Totals,
  requiredDays: number,
  perCrewPerDay: PerCrewPerDay,
  capacityKg: number,
  rocketName: string | null,
): Check {
  const raw = lifeSupportNeedKg(t.crewCount, requiredDays, perCrewPerDay, 0, 0)
  const need = lifeSupportNeedKg(
    t.crewCount,
    requiredDays,
    perCrewPerDay,
    t.waterRecoveryRate,
    t.oxygenRecoveryRate,
  )
  const needKg = need.oxygen + need.food + need.water
  const savedKg = raw.oxygen + raw.water - (need.oxygen + need.water)
  const dryKg = t.partsMassKg + t.crewMassKg
  const totalKg = dryKg + needKg
  const fits = capacityKg > 0 && totalKg <= capacityKg

  const recycling: string[] = []
  if (t.waterRecoveryRate > 0) {
    recycling.push(
      `your ${fmtPct(t.waterRecoveryRate)} water recycler cuts water to ${fmt(need.water)} kg`,
    )
  }
  if (t.oxygenRecoveryRate > 0) {
    recycling.push(
      `your ${fmtPct(t.oxygenRecoveryRate)} oxygen system cuts oxygen to ${fmt(need.oxygen)} kg`,
    )
  }
  const recyclingText =
    recycling.length > 0
      ? ` ${capitalise(recycling.join(' and '))}, saving ${fmt(savedKg)} kg.`
      : ' No recyclers on board, so all of it must be launched.'
  const fitText =
    capacityKg <= 0
      ? ' There is no launcher that can carry it.'
      : ` Dry mass ${fmt(dryKg)} kg plus ${fmt(needKg)} kg of required supplies is ${fmt(totalKg)} kg against the ${rocketName ?? 'launcher'}'s ${fmt(capacityKg)} kg` +
        (fits ? '.' : `, ${fmt(totalKg - capacityKg)} kg too heavy.`)

  return {
    id: 'supply-feasibility',
    label: 'Supply mass feasibility',
    status: t.crewCount === 0 || fits ? 'ok' : 'fail',
    value: totalKg,
    limit: capacityKg,
    unit: 'kg',
    explanation:
      t.crewCount === 0
        ? 'No crew on board, so no consumables are needed.'
        : `Without recycling, ${fmt(requiredDays)} days need ${fmt(raw.water)} kg of water and ${fmt(raw.oxygen)} kg of oxygen.` +
          recyclingText +
          fitText,
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
