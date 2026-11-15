import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { CrewMember } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { ROLE_LABEL } from '@/ui/labels'
import { SegmentBar } from '@/ui/SegmentBar'
import { PopupPanel } from '../PopupPanel'
import { StationShell } from './StationShell'
import { dailyUse, type Gauge } from './missionRun'

function Bar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const tone = v <= 25 ? 'bg-danger' : v <= 50 ? 'bg-alert' : 'bg-accent'
  return (
    <div className="flex items-center gap-2" data-testid={`crew-${label.toLowerCase()}`}>
      <span className="w-16 font-title text-sm tracking-wide text-muted uppercase">{label}</span>
      <SegmentBar share={v / 100} fill={tone} className="flex-1" />
      <span className="w-8 text-right font-mono text-xs text-primary tabular-nums">{v}</span>
    </div>
  )
}

interface CrewStatusProps {
  member: CrewMember
  run: MissionState
  content: EngineContent
  /** Their post's name, e.g. "Science Bench". */
  post: string
  onClose: () => void
}

/** Walk up to a crew member and press E: portrait, role, condition and what they are doing. */
export function CrewStatusPopup({ member, run, content, post, onClose }: CrewStatusProps) {
  const c = run.crew[member.id]
  const last = [...run.decisions].reverse().find((d) => d.crewId === member.id)
  const lastEvent = last && content.events.find((e) => e.id === last.eventId)
  const task = !c
    ? 'Not on this mission'
    : c.health <= 0
      ? 'Incapacitated'
      : c.busyTurns > 0
        ? `Busy with "${lastEvent?.title ?? 'a task'}" (${c.busyTurns} more turn${c.busyTurns > 1 ? 's' : ''})`
        : `Standing by at the ${post}`
  return (
    <PopupPanel section="Crew" title={member.name} onClose={onClose}>
      <div className="mx-auto flex max-w-3xl gap-6 px-6 py-6" data-testid="crew-status">
        <AssetImage
          kind="portraits"
          id={member.portrait}
          label={member.name}
          className="size-32 shrink-0 border-2 border-border-strong"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-title text-sm tracking-widest text-alert uppercase">
            {ROLE_LABEL[member.role]}
          </p>
          <Bar label="Energy" value={c?.energy ?? 0} />
          <Bar label="Morale" value={c?.morale ?? 0} />
          <Bar label="Health" value={c?.health ?? 0} />
          <p className="pt-1 text-sm text-muted">
            <span className="font-title tracking-wide text-subtle uppercase">Task · </span>
            {task}
          </p>
        </div>
      </div>
    </PopupPanel>
  )
}

interface ResourcesProps {
  run: MissionState
  design: Design
  gauges: Gauge[]
  talk?: { member: CrewMember; line: string }
  onClose: () => void
}

const CONSUMABLES = [
  { key: 'waterKg', label: 'Water' },
  { key: 'foodKg', label: 'Food' },
  { key: 'oxygenKg', label: 'Oxygen' },
] as const

/** The Power & Life Support panel: every resource, and how long the consumables last. */
export function ResourcesPopup({ run, design, gauges, talk, onClose }: ResourcesProps) {
  return (
    <StationShell
      title="Power & Life Support"
      testId="resources-popup"
      talk={talk}
      onClose={onClose}
    >
      <div>
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="text-left font-title tracking-wide text-subtle uppercase">
              <th className="py-1 font-normal">Supply</th>
              <th className="font-normal">Left</th>
              <th className="font-normal">Use / day</th>
              <th className="font-normal">Days left</th>
            </tr>
          </thead>
          <tbody>
            {CONSUMABLES.map(({ key, label }) => {
              const left = run.resources[key]
              const use = dailyUse(run, design, key)
              return (
                <tr key={key} className="border-t border-border tabular-nums">
                  <td className="py-1 text-muted">{label}</td>
                  <td className="text-primary">{Math.round(left).toLocaleString('en-US')} kg</td>
                  <td className="text-primary">{use > 0 ? `${use.toFixed(1)} kg` : '-'}</td>
                  <td className="text-primary">
                    {use > 0 ? Math.floor(left / use).toLocaleString('en-US') : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <ul className="mt-4 space-y-1">
          {gauges.map((g) => (
            <li key={g.id} className="flex justify-between border-t border-border pt-1 text-sm">
              <span className="font-title tracking-wide text-muted uppercase">{g.label}</span>
              <span
                className={`font-mono tabular-nums ${g.status === 'ok' ? 'text-primary' : g.status === 'low' ? 'text-alert' : 'text-danger'}`}
              >
                {g.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </StationShell>
  )
}
