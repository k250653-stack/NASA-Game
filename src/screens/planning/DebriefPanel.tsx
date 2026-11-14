import { useMemo } from 'react'
import { getContent } from '@/content/load'
import { analyzeCauses, type CauseSeverity } from '@/engine/causes'
import { computeScore } from '@/engine/score'
import type { Design, MissionState } from '@/engine/types'
import { Badge, type BadgeVariant } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { Panel } from '@/ui/Panel'
import { ResourceBar } from '@/ui/ResourceBar'

const SEVERITY_BADGE: Record<CauseSeverity, BadgeVariant> = {
  critical: 'danger',
  major: 'warning',
  minor: 'neutral',
  positive: 'success',
}

const OUTCOME_BADGE = { success: 'success', partial: 'warning', failed: 'danger' } as const

/** Debug debrief: score breakdown, stars, bonus objectives and Failure Review cause chains. */
export function DebriefPanel({ mission, design }: { mission: MissionState; design: Design }) {
  const { score, causes } = useMemo(() => {
    const content = getContent()
    return {
      score: computeScore(mission, design, content),
      causes: analyzeCauses(mission, design, content),
    }
  }, [mission, design])
  const parts = Object.entries(score.parts) as Array<
    [string, { score: number; explanation: string }]
  >

  return (
    <Panel
      title="Debrief"
      subtitle="computeScore + analyzeCauses"
      actions={<Badge variant={OUTCOME_BADGE[score.outcome]}>{score.outcome}</Badge>}
    >
      <div className="flex items-center gap-6">
        <div>
          <p className="font-mono text-5xl text-primary tabular-nums">{score.total}</p>
          <p className="text-xs text-muted">of 100</p>
        </div>
        <div className="flex gap-1" aria-label={`${score.stars} of 3 stars`}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`text-3xl ${n <= score.stars ? 'text-alert' : 'text-border-strong'}`}
            >
              ★
            </span>
          ))}
        </div>
        <ul className="ml-auto flex flex-col gap-1 text-sm">
          {score.bonusObjectives.map((b) => (
            <li key={b.id} className={b.achieved ? 'text-success' : 'text-subtle'}>
              <Icon
                name={b.achieved ? 'IconCircleCheck' : 'IconX'}
                size={14}
                className="mr-1 inline"
              />
              {b.label} (+{b.points})
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
        {parts.map(([name, part]) => (
          <div key={name}>
            <ResourceBar
              label={name}
              value={Math.round(part.score)}
              max={100}
              warnAt={60}
              dangerAt={40}
            />
            <p className="mt-1 text-xs text-muted">{part.explanation}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-6 font-display text-sm font-semibold tracking-[0.14em] text-primary uppercase">
        Failure Review Board
      </h3>
      <ol className="mt-2 flex flex-col gap-3">
        {causes.map((c) => (
          <li key={c.id} className="rounded-md border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <Badge variant={SEVERITY_BADGE[c.severity]}>{c.severity}</Badge>
              <p className="font-medium text-primary">{c.headline}</p>
              {c.impact.scorePointsLost > 0 && (
                <span className="ml-auto font-mono text-xs text-danger">
                  −{c.impact.scorePointsLost} pts
                </span>
              )}
            </div>
            <ol className="mt-2 flex flex-col gap-1 text-sm text-muted">
              {c.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-subtle">{i === 0 ? '•' : '→'}</span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-subtle">
              Root decision: {c.rootDesignDecision.label} ({String(c.rootDesignDecision.value)})
            </p>
            <p className="mt-1 text-sm text-accent">{c.suggestion}</p>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
