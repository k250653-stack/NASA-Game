import { getContent } from '@/content/load'
import type { MissionState } from '@/engine/types'
import { StatChip } from '@/ui/StatChip'

const n = (v: number, digits = 0) => v.toLocaleString('en-US', { maximumFractionDigits: digits })

/** Day, phase, resources and crew numbers for the debug simulator. */
export function MissionReadout({ mission: s }: { mission: MissionState }) {
  const crew = getContent().crew
  const r = s.resources
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <StatChip label="Day" value={n(s.day)} />
        <StatChip
          label="Turn"
          value={`${Math.min(s.turnIndex + 1, s.totalTurns)} / ${s.totalTurns}`}
        />
        <StatChip label="Phase" value={s.phaseId} tone="accent" />
        <StatChip label="Where" value={s.location} />
        <StatChip label="Dust" value={`${n(s.dustLevel * 100, 1)}%`} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatChip
          icon="IconBolt"
          label="Net power"
          value={n(r.power)}
          unit="W"
          tone={r.power < 0 ? 'danger' : 'neutral'}
        />
        <StatChip icon="IconBattery" label="Battery" value={n(r.batteryWh)} unit="Wh" />
        <StatChip icon="IconLungs" label="O2" value={n(r.oxygenKg, 1)} unit="kg" />
        <StatChip icon="IconDroplet" label="Water" value={n(r.waterKg, 1)} unit="kg" />
        <StatChip label="Food" value={n(r.foodKg, 1)} unit="kg" />
        <StatChip icon="IconShirt" label="Suits" value={r.suits} />
        <StatChip icon="IconTool" label="Spare kits" value={r.spareKits} />
        <StatChip
          icon="IconFlask"
          label="Science"
          value={n(r.sciencePoints, 1)}
          unit="pts"
          tone="accent"
        />
        <StatChip icon="IconAntenna" label="Sent home" value={n(r.scienceGb, 1)} unit="GB" />
        <StatChip label="Backlog" value={n(r.dataBacklogGb, 1)} unit="GB" />
      </div>
      {s.activeEffects.length > 0 && (
        <p className="text-xs text-muted">
          Active effects:{' '}
          {s.activeEffects.map((e) => `${e.target} ×${e.value} (${e.turnsLeft} turns)`).join(', ')}
        </p>
      )}
      {Object.keys(s.disabledParts).length > 0 && (
        <p className="text-xs text-alert">
          Offline:{' '}
          {Object.entries(s.disabledParts)
            .map(([id, t]) => `${id} (${t} turns)`)
            .join(', ')}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead className="text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="py-1 font-medium">Crew</th>
            <th className="py-1 text-right font-medium">Energy</th>
            <th className="py-1 text-right font-medium">Morale</th>
            <th className="py-1 text-right font-medium">Health</th>
            <th className="py-1 text-right font-medium">Busy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono tabular-nums">
          {Object.entries(s.crew).map(([id, c]) => (
            <tr key={id}>
              <td className="py-1 font-sans text-primary">
                {crew.find((m) => m.id === id)?.name ?? id}
              </td>
              <td className="py-1 text-right text-muted">{n(c.energy)}</td>
              <td className="py-1 text-right text-muted">{n(c.morale)}</td>
              <td className={`py-1 text-right ${c.health < 50 ? 'text-danger' : 'text-primary'}`}>
                {n(c.health)}
              </td>
              <td className="py-1 text-right text-subtle">{c.busyTurns}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
