import { computeTotals } from '@/engine/budget'
import {
  canEdit,
  supplyDaysToKg,
  supplyKgToDays,
  type DesignChange,
  type SupplyKey,
} from '@/engine/planning'
import { supplyReadout } from '@/engine/planningHints'
import type { Design, EngineContent } from '@/engine/types'
import type { RoleChoice } from '@/schemas'
import { Button } from '@/ui/Button'
import { compactNumber } from '@/ui/compactNumber'

interface SuppliesPanelProps {
  design: Design
  seat: RoleChoice
  content: EngineContent
  ownerName: string
  onEdit: (change: DesignChange) => void
}

const ROWS: Array<{ key: SupplyKey; label: string; limiting: 'water' | 'food' | 'oxygen' }> = [
  { key: 'waterKg', label: 'Water', limiting: 'water' },
  { key: 'foodKg', label: 'Food', limiting: 'food' },
  { key: 'oxygenKg', label: 'Oxygen', limiting: 'oxygen' },
]

/** Sliders in days (the engine converts to kg), plus suits and spare kits. Body of a section. */
export function SuppliesPanel({ design, seat, content, ownerName, onEdit }: SuppliesPanelProps) {
  const editable = canEdit(seat, { kind: 'supply', resource: 'waterKg', deltaKg: 0 }, content)
  const read = supplyReadout(design, content)
  const t = computeTotals(design, content)
  // Sliders reach twice the required days so there is room to over-pack.
  const maxDays = Math.ceil(read.requiredDays * 2)
  const suitPart = content.parts
    .filter((p) => p.category === 'suit')
    .sort((a, b) => (a.stats.suitCount ?? 0) - (b.stats.suitCount ?? 0))[0]
  const kitPart = content.parts
    .filter((p) => p.category === 'spares')
    .sort((a, b) => (a.stats.spareKits ?? 0) - (b.stats.spareKits ?? 0))[0]
  const lastOf = (category: string) =>
    [...design.partIds]
      .reverse()
      .find((id) => content.parts.find((p) => p.id === id)?.category === category)

  return (
    <div className="flex min-w-0 flex-col gap-2.5" data-testid="supplies-body">
      <p className="text-xs text-subtle">
        {editable
          ? `Need ${read.missionDays} days + reserve = ${read.requiredDays} days.`
          : `View only: managed by ${ownerName}.`}
      </p>
      {ROWS.map((row) => {
        const days = supplyKgToDays(design, row.key, design.supplies[row.key], content)
        const shown = Number.isFinite(days) ? Math.round(days) : maxDays
        const limiting = read.limiting === row.limiting
        return (
          <label key={row.key} className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
              <span
                className={`truncate ${limiting ? 'font-semibold text-alert' : 'text-primary'}`}
              >
                {row.label}
                {limiting && ' · first'}
              </span>
              <span className="shrink-0 font-mono text-xs whitespace-nowrap text-muted tabular-nums">
                {Number.isFinite(days) ? `${Math.round(days)} days` : 'recycled'} ·{' '}
                {compactNumber(design.supplies[row.key])} kg
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={maxDays}
              step={1}
              value={Math.min(shown, maxDays)}
              disabled={!editable || !Number.isFinite(days)}
              aria-label={`${row.label} in days`}
              onChange={(e) => {
                const kg = supplyDaysToKg(design, row.key, Number(e.target.value), content)
                onEdit({
                  kind: 'supply',
                  resource: row.key,
                  deltaKg: Math.round(kg) - design.supplies[row.key],
                })
              }}
              className="w-full accent-[var(--color-accent)]"
            />
          </label>
        )
      })}
      <p className="text-sm text-muted" data-testid="supply-days">
        Lasts{' '}
        <span className="font-mono text-primary">
          {Number.isFinite(read.days) ? Math.round(read.days) : '∞'}
        </span>{' '}
        of <span className="font-mono text-primary">{read.requiredDays}</span> days needed.
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 text-sm">
        <span className="text-muted">Suits</span>
        <span className="font-mono text-primary">{t.suitCount}</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={!editable || !suitPart}
          onClick={() => suitPart && onEdit({ kind: 'addPart', partId: suitPart.id })}
          aria-label="Add a suit"
        >
          +
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!editable || !lastOf('suit')}
          onClick={() => {
            const id = lastOf('suit')
            if (id) onEdit({ kind: 'removePart', partId: id })
          }}
          aria-label="Remove a suit"
        >
          −
        </Button>
        <span className="ml-2 text-muted">Spare kits</span>
        <span className="font-mono text-primary">{t.spareKits}</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={!editable || !kitPart}
          onClick={() => kitPart && onEdit({ kind: 'addPart', partId: kitPart.id })}
          aria-label="Add a spare kit"
        >
          +
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!editable || !lastOf('spares')}
          onClick={() => {
            const id = lastOf('spares')
            if (id) onEdit({ kind: 'removePart', partId: id })
          }}
          aria-label="Remove a spare kit"
        >
          −
        </Button>
      </div>
    </div>
  )
}
