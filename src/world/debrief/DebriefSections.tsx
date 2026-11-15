import type { RunComparison } from '@/engine/compareRuns'
import type { MissionScore } from '@/engine/score'
import type { MissionState } from '@/engine/types'
import type { CrewMember } from '@/schemas'
import { useStore } from '@/store'
import { AssetImage } from '@/ui/AssetImage'
import { InfoTip } from '@/ui/InfoTip'
import { PlayerPortrait } from '@/ui/PlayerPortrait'
import { SegmentBar } from '@/ui/SegmentBar'
import { ROLE_LABEL } from '@/ui/labels'
import { reactionLine, scoreTone } from './debrief'

export const H3 = 'font-title text-lg tracking-widest text-alert uppercase'

const PARTS = [
  { key: 'science', label: 'Science' },
  { key: 'safety', label: 'Crew safety' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'teamwork', label: 'Teamwork' },
] as const

/** Four score rows with a bar and the engine's explanation, then the bonus objectives. */
export function ScoreBreakdown({ score }: { score: MissionScore }) {
  return (
    <section>
      <h3 className={H3}>Score breakdown</h3>
      <ul className="mt-2 space-y-2" data-testid="score-breakdown">
        {PARTS.map(({ key, label }) => {
          const part = score.parts[key]
          const v = Math.round(part.score)
          return (
            <li key={key}>
              <div className="flex items-center gap-3">
                <span className="w-28 font-title tracking-wide text-primary uppercase">
                  {label}
                </span>
                <SegmentBar share={v / 100} fill={scoreTone(v)} height="h-3" className="flex-1" />
                <span className="w-8 text-right font-mono text-sm text-primary tabular-nums">
                  {v}
                </span>
                <InfoTip label={`${label}: how it was scored`}>{part.explanation}</InfoTip>
              </div>
            </li>
          )
        })}
      </ul>
      <h3 className={`${H3} mt-4`}>Bonus objectives</h3>
      <ul className="mt-1 space-y-0.5" data-testid="bonus-objectives">
        {score.bonusObjectives.map((b) => (
          <li key={b.id} className="flex gap-2 text-sm">
            <span className={b.achieved ? 'text-success' : 'text-danger'}>
              {b.achieved ? '✓' : '✗'}
            </span>
            <span className={b.achieved ? 'text-primary' : 'text-muted'}>{b.label}</span>
            <span className="ml-auto font-mono text-xs text-subtle tabular-nums">
              +{b.achieved ? b.points : 0}
            </span>
          </li>
        ))}
        {score.bonusObjectives.length === 0 && (
          <li className="text-sm text-muted">None for this scenario.</li>
        )}
      </ul>
    </section>
  )
}

/** Each crew member's portrait and one line about how it went. */
export function CrewReactions({
  crew,
  run,
  outcome,
}: {
  crew: readonly CrewMember[]
  run: MissionState
  outcome: MissionScore['outcome']
}) {
  const callsign = useStore((s) => s.game.callsign)
  return (
    <ul className="space-y-2" data-testid="crew-reactions">
      <li className="flex items-center gap-3" data-testid="debrief-player">
        <PlayerPortrait size={64} />
        <div className="min-w-0">
          <p className="font-title tracking-wide text-primary uppercase">
            {callsign || 'You'} <span className="text-xs text-subtle normal-case">Your plan</span>
          </p>
          <p className="text-sm text-muted">You set the design; here is how your crew felt.</p>
        </div>
      </li>
      {crew.map((m) => {
        const c = run.crew[m.id]
        return (
          <li key={m.id} className="flex items-center gap-3">
            <AssetImage
              kind="portraits"
              id={m.portrait}
              label={m.name}
              className="size-16 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-title tracking-wide text-primary uppercase">
                {m.name}{' '}
                <span className="text-xs text-subtle normal-case">{ROLE_LABEL[m.role]}</span>
              </p>
              <p className="text-sm text-muted">
                “{reactionLine(outcome, c?.morale ?? 0, c?.health ?? 0)}”
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const DELTAS = [
  { key: 'science', label: 'Science' },
  { key: 'safety', label: 'Crew safety' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'total', label: 'Total' },
] as const

/** What changed since the last run of this scenario, and how each score part moved. */
export function RunCompare({ cmp, changes }: { cmp: RunComparison; changes: readonly string[] }) {
  return (
    <section data-testid="run-compare">
      <h3 className={H3}>Compared to last run</h3>
      <ul className="mt-1 space-y-0.5 font-mono text-xs text-muted">
        {changes.slice(0, 8).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
        {changes.length === 0 && <li>Same design as last time.</li>}
      </ul>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
        {DELTAS.map(({ key, label }) => {
          const d = Math.round(cmp.scoreDeltas[key])
          return (
            <li key={key} className={d > 0 ? 'text-success' : d < 0 ? 'text-danger' : 'text-muted'}>
              {label} {d > 0 ? '▲' : d < 0 ? '▼' : '='} {d !== 0 && Math.abs(d)}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
