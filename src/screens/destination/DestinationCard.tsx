import { destinationSummary } from '@/engine/destinationInfo'
import type { Destination } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { Card } from '@/ui/Card'
import { StatChip } from '@/ui/StatChip'

interface DestinationCardProps {
  destination: Destination
  selected: boolean
  onSelect: () => void
}

/** Large selectable card: art, name, pitch, recommendation and facts from destinations.json. */
export function DestinationCard({ destination: d, selected, onSelect }: DestinationCardProps) {
  const facts = destinationSummary(d)
  return (
    <Card
      selected={selected}
      onSelect={onSelect}
      label={`${d.name}: ${d.recommendation.label}`}
      padded={false}
    >
      <AssetImage
        kind="backgrounds"
        id={`dest-${d.id}`}
        label={d.name}
        className="h-56 w-full rounded-t-lg object-cover"
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-primary">{d.name}</h2>
          <Badge variant={d.recommendation.tone}>{d.recommendation.label}</Badge>
        </div>
        <p className="mt-2 text-muted">{d.pitch}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatChip icon="IconRocket" label="Transit" value={facts.transit} />
          <StatChip icon="IconAntenna" label="Signal delay" value={facts.signalDelay} />
          <StatChip icon="IconSolarPanel" label="Avg sunlight" value={facts.sunlight} />
          <StatChip icon="IconWeight" label="Gravity" value={facts.gravity} />
          <StatChip
            icon="IconPackage"
            label="Resupply"
            value={facts.resupply}
            tone={d.resupplyPossible ? 'success' : 'alert'}
          />
          <StatChip label="Mission length" value={facts.missionLength} tone="accent" />
        </div>
      </div>
    </Card>
  )
}
