import { canEdit, ownerOfCategory, type DesignChange } from '@/engine/planning'
import type { Design, EngineContent } from '@/engine/types'
import type { Part, Role, RoleChoice } from '@/schemas'
import { Icon } from '@/ui/Icon'
import { Tabs } from '@/ui/Tabs'
import { Tooltip } from '@/ui/Tooltip'

interface PartsCatalogProps {
  design: Design
  seat: RoleChoice
  content: EngineContent
  ownerName: (role: Role) => string
  onEdit: (change: DesignChange) => void
}

const ACT =
  'flex size-7 items-center justify-center border-2 border-border-strong font-mono text-sm text-primary hover:border-accent hover:text-accent'

/** Parts grouped by the seat that owns them, as a compact list: icon, name, mass/power/cost. */
export function PartsCatalog({ design, seat, content, ownerName, onEdit }: PartsCatalogProps) {
  const roles = content.roles.filter((r) => r.id !== 'director' && r.owns.categories.length > 0)
  const ordered = [...roles].sort((a, b) => Number(b.id === seat) - Number(a.id === seat))

  const row = (part: Part) => {
    const count = design.partIds.filter((id) => id === part.id).length
    const sameCategory = design.partIds.find(
      (id) => id !== part.id && content.parts.find((p) => p.id === id)?.category === part.category,
    )
    const add: DesignChange = { kind: 'addPart', partId: part.id }
    const editable = canEdit(seat, add, content)
    const owner = ownerName(ownerOfCategory(part.category, content))
    const power = part.powerW > 0 ? `+${part.powerW}` : `${part.powerW}`
    return (
      <li
        key={part.id}
        className={`flex items-center gap-2 border-l-2 py-1.5 pr-1 pl-2 ${count > 0 ? 'border-accent bg-accent/5' : 'border-transparent'}`}
      >
        <Icon name={part.icon} size={18} className={count > 0 ? 'text-accent' : 'text-muted'} />
        <Tooltip content={part.description}>
          <span tabIndex={0} className="min-w-0 flex-1 truncate text-sm text-primary">
            {part.name}
            {count > 0 && <span className="ml-1 font-mono text-accent">×{count}</span>}
          </span>
        </Tooltip>
        <span className="w-24 shrink-0 text-right font-mono text-xs leading-tight text-muted tabular-nums">
          {part.massKg}kg · {power}W · ${part.costM}M
        </span>
        {editable ? (
          <span className="flex shrink-0 gap-1">
            {count === 0 && sameCategory ? (
              <button
                type="button"
                className={ACT}
                aria-label={`Swap in ${part.name}`}
                title="Swap in"
                onClick={() => onEdit({ kind: 'swapPart', fromId: sameCategory, toId: part.id })}
              >
                ⇄
              </button>
            ) : null}
            {count > 0 && (
              <button
                type="button"
                className={ACT}
                aria-label={`Remove ${part.name}`}
                onClick={() => onEdit({ kind: 'removePart', partId: part.id })}
              >
                −
              </button>
            )}
            <button
              type="button"
              className={ACT}
              aria-label={`Add ${part.name}`}
              onClick={() => onEdit(add)}
              data-testid={`add-${part.id}`}
            >
              +
            </button>
          </span>
        ) : (
          <Tooltip content={`Owned by ${owner}: ask them in a trade.`}>
            <span tabIndex={0} className="shrink-0 text-subtle" aria-label={`Owned by ${owner}`}>
              <Icon name="IconAlertOctagon" size={16} />
            </span>
          </Tooltip>
        )}
      </li>
    )
  }

  return (
    <Tabs
      tabs={ordered.map((r) => ({
        id: r.id,
        label: r.id === seat ? `${r.name} (you)` : r.name,
        content: (
          <ul className="flex flex-col">
            {content.parts.filter((p) => r.owns.categories.includes(p.category)).map(row)}
          </ul>
        ),
      }))}
    />
  )
}
