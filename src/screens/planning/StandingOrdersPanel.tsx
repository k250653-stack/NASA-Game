import type { StandingOrders } from '@/schemas'
import { Panel } from '@/ui/Panel'
import { SegmentedControl } from '@/ui/SegmentedControl'

/** What the crew does under each order when you cannot answer in time (Mars signal delay). */
const ORDERS: {
  [K in keyof StandingOrders]: {
    title: string
    options: Array<{ id: StandingOrders[K]; label: string; description: string }>
  }
} = {
  powerEmergency: {
    title: 'Power emergency',
    options: [
      {
        id: 'shed_science',
        label: 'Shed science',
        description: 'Switch instruments off first to keep life support running.',
      },
      {
        id: 'repair_eva',
        label: 'Repair by EVA',
        description: 'Send someone outside with a spare kit to fix the power system.',
      },
      {
        id: 'wait',
        label: 'Wait',
        description: 'Change nothing and ride it out: risky if the battery runs flat.',
      },
    ],
  },
  crewInjury: {
    title: 'Crew injury',
    options: [
      { id: 'rest', label: 'Rest', description: 'Injured crew stay inside until they recover.' },
      {
        id: 'continue',
        label: 'Continue',
        description: 'Injured crew keep working: faster, but injuries can get worse.',
      },
    ],
  },
  lowSupplies: {
    title: 'Low supplies',
    options: [
      {
        id: 'ration',
        label: 'Ration',
        description: 'Eat 25% less: supplies last longer, morale drops.',
      },
      {
        id: 'abort_early',
        label: 'Abort early',
        description: 'Cut the surface stay short and head home.',
      },
    ],
  },
  eva: {
    title: 'Who goes outside',
    options: [
      {
        id: 'only_practical',
        label: 'Practical only',
        description: 'Only Practical crew do EVAs: safer repairs.',
      },
      {
        id: 'best_available',
        label: 'Best available',
        description: 'Whoever has the best odds goes out.',
      },
      {
        id: 'never',
        label: 'Never',
        description: 'No EVAs at all: safest, but outside repairs are impossible.',
      },
    ],
  },
}

interface StandingOrdersPanelProps {
  orders: StandingOrders
  onChange: (orders: StandingOrders) => void
}

export function StandingOrdersPanel({ orders, onChange }: StandingOrdersPanelProps) {
  return (
    <Panel
      title="Standing orders"
      subtitle="Mars is up to 22 light-minutes away: urgent events are handled by the crew using these orders."
    >
      <div className="grid grid-cols-2 gap-5">
        {(Object.keys(ORDERS) as Array<keyof StandingOrders>).map((key) => (
          <div key={key}>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
              {ORDERS[key].title}
            </p>
            <SegmentedControl
              label={ORDERS[key].title}
              options={ORDERS[key].options}
              value={orders[key]}
              onChange={(v) => onChange({ ...orders, [key]: v })}
            />
          </div>
        ))}
      </div>
    </Panel>
  )
}
