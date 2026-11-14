import { useMemo, useState } from 'react'
import { getContent } from '@/content/load'
import { computeTotals } from '@/engine/budget'
import { canLaunch, runLaunchCheck } from '@/engine/launchCheck'
import {
  MARS_BAD_DESIGN,
  MARS_GOOD_DESIGN,
  MOON_BAD_DESIGN,
  MOON_GOOD_DESIGN,
} from '@/engine/sampleDesigns'
import { missionTimeline } from '@/engine/timeline'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Panel } from '@/ui/Panel'
import { StatChip } from '@/ui/StatChip'
import { Tabs } from '@/ui/Tabs'
import { CheckList } from './CheckList'
import { TimelineList } from './TimelineList'

const DESIGNS = {
  moon: { good: MOON_GOOD_DESIGN, bad: MOON_BAD_DESIGN },
  mars: { good: MARS_GOOD_DESIGN, bad: MARS_BAD_DESIGN },
} as const

/** Dev panel: runs the engine on a sample design and lists the timeline and Launch Check. */
export function EngineDebug() {
  const [open, setOpen] = useState(true)
  const [dest, setDest] = useState<'moon' | 'mars'>('moon')
  const [which, setWhich] = useState<'good' | 'bad'>('good')
  const design = DESIGNS[dest][which]

  const result = useMemo(() => {
    const content = getContent()
    const destination = content.destinations.find((d) => d.id === design.destinationId)!
    return {
      destination,
      totals: computeTotals(design, content),
      checks: runLaunchCheck(design, content),
      turns: missionTimeline(destination),
    }
  }, [design])
  const go = canLaunch(result.checks)
  const t = result.totals

  return (
    <Panel
      title="Engine debug"
      subtitle={`${result.destination.name} · sample ${which} design · ${design.rocketId}`}
      actions={
        <>
          <Button
            size="sm"
            variant={dest === 'moon' ? 'primary' : 'secondary'}
            aria-pressed={dest === 'moon'}
            onClick={() => setDest('moon')}
          >
            Moon
          </Button>
          <Button
            size="sm"
            variant={dest === 'mars' ? 'primary' : 'secondary'}
            aria-pressed={dest === 'mars'}
            onClick={() => setDest('mars')}
          >
            Mars
          </Button>
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
              value={Math.round(t.massKg).toLocaleString('en-US')}
              unit="kg"
            />
            <StatChip
              icon="IconBolt"
              label="Gen / use"
              value={`${Math.round(t.powerGenW)} / ${t.powerUseW}`}
              unit="W"
            />
            <StatChip icon="IconCoin" label="Cost" value={`$${t.costM.toFixed(1)}`} unit="M" />
            <StatChip
              icon="IconRecycle"
              label="Recycling H2O / O2"
              value={`${Math.round(t.waterRecoveryRate * 100)}% / ${Math.round(t.oxygenRecoveryRate * 100)}%`}
            />
            <StatChip
              icon="IconFlask"
              label="Science"
              value={t.sciencePerDay}
              unit="/surface day"
            />
          </div>
          <div className="mt-4">
            <Tabs
              key={dest}
              tabs={[
                {
                  id: 'checks',
                  label: 'Launch check',
                  content: <CheckList checks={result.checks} />,
                },
                {
                  id: 'timeline',
                  label: `Timeline (${result.turns.length} turns)`,
                  content: (
                    <TimelineList
                      destination={result.destination}
                      turns={result.turns}
                      design={design}
                    />
                  ),
                },
              ]}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">
          {result.checks.filter((c) => c.status === 'fail').length} failing,{' '}
          {result.checks.filter((c) => c.status === 'warn').length} warning.
        </p>
      )}
    </Panel>
  )
}
