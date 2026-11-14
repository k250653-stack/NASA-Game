import { useRef, useState } from 'react'
import { getContent } from '@/content/load'
import { advanceTurn, initMission, isMissionOver } from '@/engine/mission'
import { createRng, type Rng } from '@/engine/rng'
import {
  MARS_BAD_DESIGN,
  MARS_GOOD_DESIGN,
  MOON_BAD_DESIGN,
  MOON_GOOD_DESIGN,
} from '@/engine/sampleDesigns'
import type { MissionState } from '@/engine/types'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Panel } from '@/ui/Panel'
import { autoRun } from '@/engine/autopilot'
import { DebriefPanel } from './DebriefPanel'
import { MissionLog } from './MissionLog'
import { MissionReadout } from './MissionReadout'
import { PendingEvents } from './PendingEvents'

const DESIGNS = {
  'moon-good': MOON_GOOD_DESIGN,
  'moon-bad': MOON_BAD_DESIGN,
  'mars-good': MARS_GOOD_DESIGN,
  'mars-bad': MARS_BAD_DESIGN,
} as const
type DesignKey = keyof typeof DESIGNS

/** Dev panel: step a sample mission turn by turn and answer pending events. */
export function SimulatePanel() {
  const [designKey, setDesignKey] = useState<DesignKey>('moon-good')
  const [seed, setSeed] = useState(42)
  const design = DESIGNS[designKey]
  const [mission, setMission] = useState<MissionState>(() =>
    initMission(design, getContent(), seed),
  )
  // The Rng is the only mutable input of the engine; it lives outside React state and is only
  // touched in event handlers, so Strict Mode double renders never advance it twice.
  const rngRef = useRef<Rng | null>(null)

  const rng = () => (rngRef.current ??= createRng(seed))
  const reset = (key: DesignKey = designKey, newSeed: number = seed) => {
    rngRef.current = createRng(newSeed)
    setMission(initMission(DESIGNS[key], getContent(), newSeed))
  }
  const step = (turns: number) => {
    let s = mission
    for (let i = 0; i < turns && !isMissionOver(s); i++) {
      s = advanceTurn(s, design, getContent(), rng()).state
    }
    setMission(s)
  }
  const over = isMissionOver(mission)

  return (
    <Panel
      title="Simulate mission"
      subtitle={`Player flies ${design.playerRole ?? 'every role'} · standing orders: ${Object.values(design.standingOrders).join(', ')}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Sample design
          <select
            value={designKey}
            onChange={(e) => {
              const key = e.target.value as DesignKey
              setDesignKey(key)
              reset(key)
            }}
            className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-primary"
          >
            {Object.keys(DESIGNS).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => {
              const n = Number(e.target.value) || 0
              setSeed(n)
              reset(designKey, n)
            }}
            className="h-10 w-28 rounded-md border border-border-strong bg-surface px-2 font-mono text-sm text-primary"
          />
        </label>
        <Button onClick={() => step(1)} disabled={over}>
          Next turn
        </Button>
        <Button variant="secondary" onClick={() => step(Infinity)} disabled={over}>
          Run to end
        </Button>
        <Button
          variant="secondary"
          onClick={() => setMission(autoRun(mission, design, getContent(), rng()))}
          disabled={over}
        >
          Auto-run to end
        </Button>
        <Button variant="ghost" onClick={() => reset()}>
          Reset
        </Button>
        {mission.outcome === 'failed' && <Badge variant="danger">Failed</Badge>}
        {over && mission.outcome !== 'failed' && <Badge variant="success">Mission complete</Badge>}
      </div>
      {mission.failReason && <p className="mt-3 text-sm text-danger">{mission.failReason}</p>}
      {over && (
        <div className="mt-4">
          <DebriefPanel mission={mission} design={design} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <MissionReadout mission={mission} />
        <div className="flex flex-col gap-4">
          <PendingEvents mission={mission} design={design} rng={rng} onResolve={setMission} />
          <MissionLog log={mission.eventLog} />
        </div>
      </div>
    </Panel>
  )
}
