import { useMemo, useState } from 'react'
import { getContent } from '@/content/load'
import { computeTotals } from '@/engine/budget'
import { canLaunch, runLaunchCheck } from '@/engine/launchCheck'
import { BAD_DESIGN, GOOD_DESIGN } from '@/engine/sampleDesigns'
import type { CheckStatus } from '@/engine/types'
import { Badge, type BadgeVariant } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Panel } from '@/ui/Panel'
import { StatChip } from '@/ui/StatChip'

const STATUS_BADGE: Record<CheckStatus, BadgeVariant> = {
  ok: 'success',
  warn: 'warning',
  fail: 'danger',
}

/** Dev panel: runs the engine on a sample design and lists the Launch Check. */
export function EngineDebug() {
  const [open, setOpen] = useState(true)
  const [which, setWhich] = useState<'good' | 'bad'>('good')
  const design = which === 'good' ? GOOD_DESIGN : BAD_DESIGN

  const { totals, checks } = useMemo(() => {
    const content = getContent()
    return { totals: computeTotals(design, content), checks: runLaunchCheck(design, content) }
  }, [design])
  const go = canLaunch(checks)

  return (
    <Panel
      title="Engine debug"
      subtitle={`Sample ${which} design · ${design.rocketId}`}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setWhich(which === 'good' ? 'bad' : 'good')}
          >
            Show {which === 'good' ? 'bad' : 'good'} design
          </Button>
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Collapse' : 'Expand'}
          </Button>
        </>
      }
    >
      {open ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant={go ? 'success' : 'danger'}>{go ? 'GO for launch' : 'NO-GO'}</Badge>
            <StatChip
              icon="IconWeight"
              label="Mass"
              value={totals.massKg.toLocaleString('en-US')}
              unit="kg"
            />
            <StatChip icon="IconBolt" label="Gen" value={Math.round(totals.powerGenW)} unit="W" />
            <StatChip icon="IconBolt" label="Use" value={totals.powerUseW} unit="W" />
            <StatChip icon="IconCoin" label="Cost" value={`$${totals.costM.toFixed(1)}`} unit="M" />
            <StatChip
              icon="IconAntenna"
              label="Data"
              value={`${totals.dataGenGbPerDay} → ${totals.dataReturnGbPerDay}`}
              unit="GB/d"
            />
            <StatChip icon="IconFlask" label="Science" value={totals.sciencePerDay} unit="/day" />
          </div>
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
                <Badge variant={STATUS_BADGE[c.status]} className="mt-0.5 w-12 justify-center">
                  {c.status}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">{c.label}</p>
                  <p className="text-sm text-muted">{c.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">
          {checks.filter((c) => c.status === 'fail').length} failing,{' '}
          {checks.filter((c) => c.status === 'warn').length} warning.
        </p>
      )}
    </Panel>
  )
}
