import type { Design, EngineContent } from '@/engine/types'
import { ownerOfCategory } from '@/engine/planning'
import type { RoleChoice } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Icon } from '@/ui/Icon'
import { Tooltip } from '@/ui/Tooltip'

interface BaseViewProps {
  design: Design
  seat: RoleChoice
  content: EngineContent
}

/**
 * The base illustration, filling the height it is given (largest 16:9 box that fits). Only
 * installed parts get a marker; each parts fills the slots of its category in order.
 */
export function BaseView({ design, seat, content }: BaseViewProps) {
  const layout = content.baseSlots.find((b) => b.destinationId === design.destinationId)
  const parts = design.partIds
    .map((id) => content.parts.find((p) => p.id === id))
    .filter((p) => p !== undefined)
  const used = new Map<string, number>()
  const markers = (layout?.slots ?? []).flatMap((slot) => {
    const i = used.get(slot.category) ?? 0
    used.set(slot.category, i + 1)
    const part = parts.filter((p) => p.category === slot.category)[i]
    if (!part) return []
    const mine = seat === 'director' || ownerOfCategory(slot.category, content) === seat
    return [{ slot, part, mine }]
  })

  return (
    // A size container lets the picture use cqw/cqh: the biggest 16:9 box inside this area.
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border-2 border-border-strong bg-surface [container-type:size]">
      <div
        className="relative"
        style={{ width: 'min(100cqw, 100cqh * 16 / 9)', aspectRatio: '16 / 9' }}
        data-testid="base-view"
      >
        <AssetImage
          kind="sprites"
          id={`base-${design.destinationId}`}
          label={`${design.destinationId} base`}
          className="absolute inset-0 size-full"
        />
        {markers.map(({ slot, part, mine }) => (
          <div
            key={slot.slotId}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <Tooltip content={part.name}>
              <button
                type="button"
                aria-label={part.name}
                className={`flex size-7 items-center justify-center border-2 border-border-strong bg-panel-raised ${mine ? 'text-accent' : 'text-muted'}`}
              >
                <Icon name={part.icon} size={16} />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  )
}
