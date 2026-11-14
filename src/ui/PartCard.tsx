import type { Part } from '@/schemas'
import { Badge } from './Badge'
import { Card } from './Card'
import { Icon } from './Icon'
import { StatChip } from './StatChip'
import { CATEGORY_LABEL, ROLE_LABEL } from './labels'

interface PartCardProps {
  part: Part
  selected?: boolean
  onSelect?: () => void
  disabled?: boolean
}

export function PartCard({ part, selected, onSelect, disabled }: PartCardProps) {
  const producing = part.powerW > 0
  const powerTone = part.powerW === 0 ? 'neutral' : producing ? 'success' : 'alert'
  return (
    <Card
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      label={onSelect ? part.name : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
          <Icon name={part.icon} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base leading-tight font-semibold text-primary">
            {part.name}
          </h3>
          <p className="text-xs text-muted">{CATEGORY_LABEL[part.category]}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted">{part.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatChip icon="IconWeight" label="Mass" value={part.massKg} unit="kg" />
        <StatChip
          icon="IconBolt"
          label="Power"
          value={`${producing ? '+' : ''}${part.powerW}`}
          unit="W"
          tone={powerTone}
        />
        <StatChip icon="IconCoin" label="Cost" value={`$${part.costM}`} unit="M" />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-subtle">
        Owner <Badge variant="neutral">{ROLE_LABEL[part.ownerRole]}</Badge>
      </div>
    </Card>
  )
}
