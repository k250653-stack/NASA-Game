import { Panel } from '@/ui/Panel'
import { ProgressSteps } from '@/ui/ProgressSteps'
import { Tabs } from '@/ui/Tabs'

export function NavigationSection() {
  return (
    <Panel title="Navigation" subtitle="ProgressSteps and Tabs (arrow keys move between tabs)">
      <div className="space-y-3">
        <ProgressSteps current="destination" />
        <ProgressSteps current="planning" />
        <ProgressSteps current="review" />
      </div>
      <div className="mt-6 border-t border-border pt-4">
        <Tabs
          tabs={[
            {
              id: 'power',
              label: 'Power',
              content: (
                <p className="text-sm text-muted">Solar array, battery and night survival.</p>
              ),
            },
            {
              id: 'comms',
              label: 'Comms',
              content: <p className="text-sm text-muted">Antenna pointing and signal delay.</p>,
            },
            {
              id: 'life',
              label: 'Life support',
              content: (
                <p className="text-sm text-muted">Air, water and consumables per crew day.</p>
              ),
            },
          ]}
        />
      </div>
    </Panel>
  )
}
