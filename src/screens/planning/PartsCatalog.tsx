import { canEdit, ownerOfCategory, type DesignChange } from '@/engine/planning'
import type { Design, EngineContent } from '@/engine/types'
import type { Part, Role, RoleChoice } from '@/schemas'
import { Icon } from '@/ui/Icon'
import { Tabs } from '@/ui/Tabs'

interface PartsCatalogProps {
  design: Design
  seat: RoleChoice
  content: EngineContent
  ownerName: (role: Role) => string
  onEdit: (change: DesignChange) => void
}

/** Short tab names so four tabs fit the narrow left column. */
const TAB_NAME: Record<Role, string> = {
  science: 'Science',
  power_life: 'Power',
  comms_nav: 'Comms',
  launch_budget: 'Launch',
}

const ACT =
  'flex size-7 shrink-0 items-center justify-center border-2 border-border-strong font-mono text-sm text-primary hover:border-accent hover:text-accent'

/**
 * Parts grouped by the seat that owns them. One compact row per part: icon, name, and the
 * mass/power/cost line under it; the +/−/⇄ buttons sit inside the row on the right.
 */
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
    const power = part.powerW > 0 ? `+${part.powerW}` : `${part.powerW}`
    return (
      <li
        key={part.id}
        className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-l-2 py-1 pr-1 pl-2 ${count > 0 ? 'border-accent bg-accent/5' : 'border-transparent'}`}
      >
        <Icon name={part.icon} size={18} className={count > 0 ? 'text-accent' : 'text-muted'} />
        <div className="min-w-0" title={part.description}>
          <p className="truncate text-sm leading-tight text-primary">
            {part.name}
            {count > 0 && <span className="ml-1 font-mono text-accent">×{count}</span>}
          </p>
          <p className="truncate font-mono text-xs leading-tight whitespace-nowrap text-muted tabular-nums">
            {part.massKg}kg · {power}W · ${part.costM}M
          </p>
        </div>
        {editable && (
          <span className="flex shrink-0 gap-1">
            {count === 0 && sameCategory && (
              <button
                type="button"
                className={ACT}
                aria-label={`Swap in ${part.name}`}
                title="Swap in"
                onClick={() => onEdit({ kind: 'swapPart', fromId: sameCategory, toId: part.id })}
              >
                ⇄
              </button>
            )}
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
        )}
      </li>
    )
  }

  return (
    <Tabs
      compact
      tabs={ordered.map((r) => {
        const mine = r.id === seat
        const list = content.parts.filter((p) => r.owns.categories.includes(p.category))
        const owner = ownerName(
          ownerOfCategory(list[0]?.category ?? r.owns.categories[0]!, content),
        )
        return {
          id: r.id,
          label: mine ? `${TAB_NAME[r.id as Role]} ★` : TAB_NAME[r.id as Role],
          content: (
            <div className="min-w-0">
              {!canEdit(seat, { kind: 'addPart', partId: list[0]?.id ?? '' }, content) && (
                <p className="mb-1 truncate text-xs text-subtle">
                  Owned by {owner} · view only. Ask in a trade.
                </p>
              )}
              <ul className="flex min-w-0 flex-col">{list.map(row)}</ul>
            </div>
          ),
        }
      })}
    />
  )
}
