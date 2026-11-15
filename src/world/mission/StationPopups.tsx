import type { BonusResult } from '@/engine/score'
import type { MissionState } from '@/engine/types'
import type { CrewMember } from '@/schemas'
import { gb, MeterBar, Row, SECTION, StationShell } from './StationShell'
import type { CommsInfo, EvaLine, PartLine } from './stationStatus'

type Talk = { member: CrewMember; line: string } | undefined

const STATUS: Record<PartLine['status'], string> = {
  ok: 'text-success',
  idle: 'text-subtle',
  paused: 'text-alert',
  disabled: 'text-danger',
}

/** Comms station: data collected, sent and waiting; link rate; delay; recent messages. */
export function CommsPopup({
  info,
  delayMin,
  talk,
  onClose,
}: {
  info: CommsInfo
  delayMin: number | null
  talk: Talk
  onClose: () => void
}) {
  return (
    <StationShell title="Data & Comms" testId="station-comms" talk={talk} onClose={onClose}>
      <div className="space-y-1">
        <Row label="Collected" value={gb(info.collectedGb)} />
        <Row label="Sent home" value={gb(info.sentGb)} tone="text-success" />
        <Row
          label="Waiting (backlog)"
          value={`${gb(info.backlogGb)} of ${gb(info.storageGb)}`}
          tone={info.storageFull ? 'text-danger' : 'text-primary'}
        />
        {info.lostGb > 0 && (
          <Row label="Lost (storage full)" value={gb(info.lostGb)} tone="text-danger" />
        )}
        <MeterBar
          share={info.backlogGb / info.storageGb}
          tone={info.storageFull ? 'bg-danger' : 'bg-accent'}
        />
        {info.storageFull && (
          <p className="text-xs text-danger">Storage is nearly full: new data will be lost.</p>
        )}
        <Row label="Return rate" value={`${gb(info.returnGbPerDay)}/day`} />
        <Row label="Contact" value={`${info.contactHours} h/day`} />
        {delayMin !== null && (
          <>
            <Row label="Signal delay" value={`${delayMin.toFixed(1)} min`} tone="text-accent" />
            <p className="text-xs text-muted">
              Your orders reach the crew {Math.round(delayMin)} min late, so urgent events run on
              standing orders.
            </p>
          </>
        )}
      </div>
      <section>
        <h3 className={SECTION}>Last messages</h3>
        <ol className="mt-1 space-y-1">
          {info.messages.map((m, i) => (
            <li key={i} className="truncate font-mono text-xs text-muted" title={m.text}>
              Day {m.day} · {m.text}
            </li>
          ))}
        </ol>
      </section>
    </StationShell>
  )
}

interface ScienceProps {
  run: MissionState
  target: number
  instruments: PartLine[]
  bonus: BonusResult[]
  talk: Talk
  onClose: () => void
}

/** Science bench: points home vs target, data gathered, each instrument's state, bonus goals. */
export function SciencePopup({ run, target, instruments, bonus, talk, onClose }: ScienceProps) {
  const pts = run.resources.sciencePoints
  return (
    <StationShell title="Science" testId="station-science" talk={talk} onClose={onClose}>
      <div className="space-y-1">
        <Row label="Sent home" value={`${Math.round(pts)} / ${target} pts`} />
        <MeterBar share={pts / target} tone="bg-role-science" />
        <Row
          label="Waiting to send"
          value={`${Math.round(run.resources.pendingSciencePoints)} pts`}
        />
        <Row
          label="Samples & readings"
          value={gb(run.resources.scienceGb + run.resources.dataBacklogGb)}
        />
      </div>
      <section>
        <h3 className={SECTION}>Instruments</h3>
        <ul className="mt-1 space-y-0.5 text-sm">
          {instruments.map((l) => (
            <li key={l.part.id} className="flex justify-between gap-3">
              <span className="text-primary">
                {l.part.name}
                {l.count > 1 && ` ×${l.count}`}
              </span>
              <span className={`text-xs ${STATUS[l.status]}`}>{l.note}</span>
            </li>
          ))}
          {instruments.length === 0 && <li className="text-muted">No instruments on board.</li>}
        </ul>
      </section>
      <section>
        <h3 className={SECTION}>Bonus objectives</h3>
        <ul className="mt-1 space-y-0.5 text-sm">
          {bonus.map((b) => (
            <li key={b.id} className="flex gap-2">
              <span className={b.achieved ? 'text-success' : 'text-subtle'}>
                {b.achieved ? '✓' : '·'}
              </span>
              <span className={b.achieved ? 'text-primary' : 'text-muted'}>{b.label}</span>
            </li>
          ))}
          {bonus.length === 0 && <li className="text-muted">None for this scenario.</li>}
        </ul>
      </section>
    </StationShell>
  )
}

/** Repair station: every installed part with its state, spare kits, active effects. */
export function RepairsPopup({
  parts,
  spares,
  effects,
  talk,
  onClose,
}: {
  parts: PartLine[]
  spares: number
  effects: string[]
  talk: Talk
  onClose: () => void
}) {
  return (
    <StationShell title="Systems & Repairs" testId="station-repair" talk={talk} onClose={onClose}>
      <Row label="Spare kits" value={spares} tone={spares > 0 ? 'text-primary' : 'text-danger'} />
      <ul className="max-h-60 space-y-0.5 overflow-y-auto text-sm">
        {parts.map((l) => (
          <li key={l.part.id} className="flex justify-between gap-3">
            <span className="text-primary">
              {l.part.name}
              {l.count > 1 && ` ×${l.count}`}
            </span>
            <span className={`text-xs ${STATUS[l.status]}`}>
              {l.status === 'disabled' ? l.note : l.status === 'ok' ? 'OK' : l.note}
            </span>
          </li>
        ))}
      </ul>
      <section>
        <h3 className={SECTION}>Active effects</h3>
        <ul className="mt-1 space-y-0.5 font-mono text-xs text-alert">
          {effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
          {effects.length === 0 && <li className="text-muted">None right now.</li>}
        </ul>
      </section>
    </StationShell>
  )
}

interface AirlockProps {
  suits: number
  suitsPacked: number
  evas: EvaLine[]
  ready: Array<{ member: CrewMember; energy: number }>
  talk: Talk
  onClose: () => void
}

/** Airlock: suits, spacewalks so far, who could go out now. */
export function AirlockPopup({ suits, suitsPacked, evas, ready, talk, onClose }: AirlockProps) {
  return (
    <StationShell title="Airlock & Suits" testId="station-airlock" talk={talk} onClose={onClose}>
      <Row
        label="Suits working"
        value={`${suits} of ${suitsPacked}`}
        tone={suits > 0 ? 'text-primary' : 'text-danger'}
      />
      <Row
        label="Damaged or lost"
        value={Math.max(0, suitsPacked - suits)}
        tone={suitsPacked > suits ? 'text-alert' : 'text-primary'}
      />
      <section>
        <h3 className={SECTION}>Spacewalks</h3>
        <ul className="mt-1 space-y-0.5 font-mono text-xs">
          {evas.map((e, i) => (
            <li key={i} className={e.success ? 'text-muted' : 'text-danger'}>
              Day {e.day} · {e.who} · {e.what} · {e.success ? 'OK' : 'failed'}
            </li>
          ))}
          {evas.length === 0 && <li className="text-muted">No spacewalks yet.</li>}
        </ul>
      </section>
      <section>
        <h3 className={SECTION}>Ready to go out</h3>
        <ul className="mt-1 flex flex-wrap gap-2">
          {suits > 0 &&
            ready.map(({ member, energy }) => (
              <li
                key={member.id}
                className="border border-border px-2 py-0.5 font-mono text-xs text-primary"
              >
                {member.name} · <span className="tabular-nums">{energy}</span> energy
              </li>
            ))}
          {(suits === 0 || ready.length === 0) && (
            <li className="text-sm text-muted">Nobody can go out right now.</li>
          )}
        </ul>
      </section>
    </StationShell>
  )
}
