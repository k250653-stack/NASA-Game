import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Panel } from '@/ui/Panel'
import { InfoTip } from '@/ui/InfoTip'
import { ResourceBar } from '@/ui/ResourceBar'
import { SegmentBar } from '@/ui/SegmentBar'

/** Demo values for the UI kit only; real values come from the engine and content. */
const DEMO = { max: 20000, warnAt: 6000, dangerAt: 3000, step: 2500, start: 14000 }

export function DataSection() {
  const [power, setPower] = useState(DEMO.start)
  const clamp = (n: number) => Math.min(DEMO.max, Math.max(0, n))

  return (
    <Panel
      title="Resource bars"
      subtitle="Animate on change, show a +/− delta, turn amber and red at thresholds"
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPower((p) => clamp(p - DEMO.step))}
          >
            − Drain
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPower((p) => clamp(p + DEMO.step))}
          >
            + Charge
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        <ResourceBar
          label="Battery (interactive)"
          icon="IconBattery"
          value={power}
          max={DEMO.max}
          unit="Wh"
          warnAt={DEMO.warnAt}
          dangerAt={DEMO.dangerAt}
        />
        <ResourceBar
          label="Nominal"
          icon="IconDroplet"
          value={410}
          max={500}
          unit="L"
          warnAt={150}
          dangerAt={60}
        />
        <ResourceBar
          label="Warning"
          icon="IconLungs"
          value={9}
          max={30}
          unit="days"
          warnAt={10}
          dangerAt={4}
        />
        <ResourceBar
          label="Danger"
          icon="IconBolt"
          value={1.8}
          max={20}
          unit="kWh"
          warnAt={6}
          dangerAt={3}
          decimals={1}
        />
        <ResourceBar
          label="Mass used (filling mode)"
          icon="IconWeight"
          value={7400}
          max={8000}
          unit="kg"
          warnAt={6800}
          dangerAt={7800}
          mode="filling"
        />
        <ResourceBar label="Science" icon="IconFlask" value={64} max={100} unit="pts" />
        <div className="flex items-center gap-3">
          <span className="label-caps text-sm text-muted">SegmentBar</span>
          <SegmentBar share={0.6} fill="bg-accent" className="flex-1" />
          <SegmentBar share={0.25} fill="bg-alert" className="flex-1" />
          <SegmentBar share={0.1} fill="bg-danger" className="flex-1" />
          <InfoTip>InfoTip: secondary details live behind this “i”.</InfoTip>
        </div>
      </div>
    </Panel>
  )
}
