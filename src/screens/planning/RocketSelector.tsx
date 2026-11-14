import { canEdit, type DesignChange } from '@/engine/planning'
import { rocketFits } from '@/engine/planningOptions'
import type { Design, EngineContent } from '@/engine/types'
import type { RoleChoice } from '@/schemas'
import { Card } from '@/ui/Card'
import { Panel } from '@/ui/Panel'
import { ResourceBar } from '@/ui/ResourceBar'
import { StatChip } from '@/ui/StatChip'

interface RocketSelectorProps {
  design: Design
  seat: RoleChoice
  content: EngineContent
  ownerName: string
  onEdit: (change: DesignChange) => void
}

/** The launchers that reach this destination, with how the current design fits each. */
export function RocketSelector({ design, seat, content, ownerName, onEdit }: RocketSelectorProps) {
  const fits = rocketFits(design, content)
  const editable = fits[0]
    ? canEdit(seat, { kind: 'rocket', rocketId: fits[0].rocketId }, content)
    : false
  return (
    <Panel
      title="Launcher"
      subtitle={editable ? 'Your call: capacity vs cost' : `View only: chosen by ${ownerName}`}
    >
      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        {fits.map((f) => {
          const rocket = content.rockets.find((r) => r.id === f.rocketId)!
          return (
            <Card
              key={f.rocketId}
              testId={`rocket-card-${f.rocketId}`}
              selected={design.rocketId === f.rocketId}
              disabled={!editable}
              onSelect={() => onEdit({ kind: 'rocket', rocketId: f.rocketId })}
              label={rocket.name}
            >
              <p className="font-display text-sm font-semibold text-primary">{rocket.name}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                <StatChip icon="IconCoin" label="Cost" value={`$${rocket.costM}`} unit="M" />
                <StatChip label="Reliability" value={`${Math.round(rocket.reliability * 100)}%`} />
              </div>
              <div className="mt-3">
                <ResourceBar
                  label="Fit"
                  value={Math.round(f.massKg)}
                  max={f.capacityKg}
                  unit="kg"
                  status={f.status}
                />
              </div>
            </Card>
          )
        })}
      </div>
    </Panel>
  )
}
