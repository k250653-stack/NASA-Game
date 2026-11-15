import { destinationSummary } from '@/engine/destinationInfo'
import type { Destination } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { Card } from '@/ui/Card'
import { StatChip } from '@/ui/StatChip'

/** Card art in public/assets/backgrounds: the Mars planet picture, dest-moon for the Moon. */
export function destinationArt(destinationId: string): string {
  return destinationId === 'mars' ? 'mars' : `dest-${destinationId}`
}

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
      testId={`destination-card-${d.id}`}
    >
      <div className="flex h-[200px] items-center justify-center bg-bg">
        <AssetImage
          kind="backgrounds"
          id={destinationArt(d.id)}
          ext="png"
          label={d.name}
          className="size-full object-contain object-center"
        />
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-primary">{d.name}</h2>
          <Badge variant={d.recommendation.tone}>{d.recommendation.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{d.pitch}</p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          <StatChip compact className="w-full" icon="IconRocket" label="Transit" value={facts.transit} />
          <StatChip compact className="w-full" icon="IconAntenna" label="Signal delay" value={facts.signalDelay} />
          <StatChip compact className="w-full" icon="IconSolarPanel" label="Avg sunlight" value={facts.sunlight} />
          <StatChip compact className="w-full" icon="IconWeight" label="Gravity" value={facts.gravity} />
          <StatChip
            icon="IconPackage"
            label="Resupply"
            value={facts.resupply}
            tone={d.resupplyPossible ? 'success' : 'alert'}
          />
          <StatChip compact className="w-full" label="Mission length" value={facts.missionLength} tone="accent" />
        </div>
      </div>
    </Card>
  )
}
