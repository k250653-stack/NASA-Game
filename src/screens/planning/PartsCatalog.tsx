import { canEdit, ownerOfCategory, type DesignChange } from '@/engine/planning'
import type { Design, EngineContent } from '@/engine/types'
import type { Part, Role, RoleChoice } from '@/schemas'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { PartCard } from '@/ui/PartCard'
import { Tabs } from '@/ui/Tabs'
import { Tooltip } from '@/ui/Tooltip'

interface PartsCatalogProps {
  design: Design
  seat: RoleChoice
  content: EngineContent
  ownerName: (role: Role) => string
  onEdit: (change: DesignChange) => void
}

/** Parts grouped by the seat that owns them; the player's tab first, others view-only. */
export function PartsCatalog({ design, seat, content, ownerName, onEdit }: PartsCatalogProps) {
  const roles = content.roles.filter((r) => r.id !== 'director' && r.owns.categories.length > 0)
  const ordered = [...roles].sort((a, b) => Number(b.id === seat) - Number(a.id === seat))

  const actions = (part: Part) => {
    const count = design.partIds.filter((id) => id === part.id).length
    const sameCategory = design.partIds.find(
      (id) => id !== part.id && content.parts.find((p) => p.id === id)?.category === part.category,
    )
    const add: DesignChange = { kind: 'addPart', partId: part.id }
    if (!canEdit(seat, add, content)) {
      const owner = ownerName(ownerOfCategory(part.category, content))
      return (
        <div className="flex items-center gap-2 text-xs text-subtle">
          {count > 0 && <span className="font-mono text-primary">×{count} on board</span>}
          <Tooltip content={`Owned by ${owner}: ask them in a trade.`}>
            <button
              type="button"
              aria-disabled="true"
              className="ml-auto flex items-center gap-1 rounded-sm px-1 py-0.5 text-subtle"
            >
              <Icon name="IconAlertOctagon" size={14} />
              Owned by {owner}
            </button>
          </Tooltip>
        </div>
      )
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {count > 0 && <span className="font-mono text-xs text-primary">×{count} on board</span>}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onEdit(add)}
          data-testid={`add-${part.id}`}
        >
          {count > 0 ? 'Add another' : 'Add'}
        </Button>
        {count === 0 && sameCategory && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit({ kind: 'swapPart', fromId: sameCategory, toId: part.id })}
          >
            Swap in
          </Button>
        )}
        {count > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit({ kind: 'removePart', partId: part.id })}
          >
            Remove
          </Button>
        )}
      </div>
    )
  }

  return (
    <Tabs
      tabs={ordered.map((r) => ({
        id: r.id,
        label:
          r.id === seat || seat === 'director'
            ? `${r.name}${r.id === seat ? ' (you)' : ''}`
            : `${r.name} · ${ownerName(r.id as Role)}`,
        content: (
          <div className="grid grid-cols-2 gap-3">
            {content.parts
              .filter((p) => r.owns.categories.includes(p.category))
              .map((p) => (
                <div key={p.id} className="flex flex-col gap-2">
                  <PartCard part={p} selected={design.partIds.includes(p.id)} />
                  {actions(p)}
                </div>
              ))}
          </div>
        ),
      }))}
    />
  )
}
