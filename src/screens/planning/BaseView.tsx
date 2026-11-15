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

/** The base illustration with a marker per slot; parts fill slots of their category in order. */
export function BaseView({ design, seat, content }: BaseViewProps) {
  const layout = content.baseSlots.find((b) => b.destinationId === design.destinationId)
  const parts = design.partIds
    .map((id) => content.parts.find((p) => p.id === id))
    .filter((p) => p !== undefined)
  const used = new Map<string, number>()
  const markers = (layout?.slots ?? []).map((slot) => {
    const ofCategory = parts.filter((p) => p.category === slot.category)
    const i = used.get(slot.category) ?? 0
    used.set(slot.category, i + 1)
    const part = ofCategory[i]
    const mine = seat === 'director' || ownerOfCategory(slot.category, content) === seat
    return { slot, part, mine }
  })

  return (
    <div className="relative mx-auto h-[270px] w-[480px] shrink-0 overflow-hidden border-2 border-border-strong bg-surface 2xl:h-[540px] 2xl:w-[960px]">
      <AssetImage
        kind="sprites"
        id={`base-${design.destinationId}`}
        label={`${design.destinationId} base`}
        className="absolute inset-0 h-full w-full"
      />
      {markers.map(({ slot, part, mine }) => (
        <div
          key={slot.slotId}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
        >
          <Tooltip content={part ? part.name : `Empty ${slot.category.replace('_', ' ')} slot`}>
            <button
              type="button"
              aria-label={part ? part.name : `Empty ${slot.category} slot`}
              className={`flex size-8 items-center justify-center rounded-md border transition-shadow ${
                part
                  ? `border-border-strong bg-panel-raised ${mine ? 'text-accent shadow-glow' : 'text-muted'}`
                  : 'border-dashed border-border-strong bg-bg/60 text-subtle'
              }`}
            >
              {part ? (
                <Icon name={part.icon} size={18} />
              ) : (
                <span className="size-1.5 rounded-full bg-border-strong" />
              )}
            </button>
          </Tooltip>
        </div>
      ))}
    </div>
  )
}
