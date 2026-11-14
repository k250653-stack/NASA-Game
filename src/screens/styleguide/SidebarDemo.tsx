import { Panel } from '@/ui/Panel'
import { ResourceBar } from '@/ui/ResourceBar'
import { StatChip } from '@/ui/StatChip'

/** Example right sidebar, as the mission screens will use it. Demo values only. */
export function SidebarDemo() {
  return (
    <>
      <Panel title="Resources" subtitle="Sidebar slot of ScreenLayout">
        <div className="space-y-4">
          <ResourceBar
            label="Power"
            icon="IconBattery"
            value={14200}
            max={20000}
            unit="Wh"
            warnAt={6000}
            dangerAt={3000}
          />
          <ResourceBar
            label="Water"
            icon="IconDroplet"
            value={180}
            max={500}
            unit="L"
            warnAt={150}
            dangerAt={60}
          />
          <ResourceBar
            label="Oxygen"
            icon="IconLungs"
            value={3}
            max={30}
            unit="days"
            warnAt={10}
            dangerAt={4}
          />
        </div>
      </Panel>
      <Panel title="Mission">
        <div className="flex flex-col gap-2">
          <StatChip label="Day" value="12 / 28" />
          <StatChip label="Signal delay" value="1.3" unit="s" tone="accent" />
          <StatChip icon="IconCoin" label="Budget left" value="$214" unit="M" />
        </div>
      </Panel>
    </>
  )
}
