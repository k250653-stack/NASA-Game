import { canEdit, type DesignChange } from '@/engine/planning'
import { rocketFits } from '@/engine/planningOptions'
import type { Design, EngineContent } from '@/engine/types'
import type { RoleChoice } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { compactMoneyM, compactNumber } from '@/ui/compactNumber'
import { rocketSprite } from '@/ui/rocketSprite'
import { SegmentBar } from '@/ui/SegmentBar'
import { TONE_FILL } from '@/ui/tones'

interface RocketSelectorProps {
  design: Design
  seat: RoleChoice
  content: EngineContent
  ownerName: string
  onEdit: (change: DesignChange) => void
}

const FIT_TONE = { ok: 'accent', warn: 'alert', fail: 'danger' } as const

/** The launchers that reach this destination as compact rows: sprite, name, capacity, cost. */
export function RocketSelector({ design, seat, content, ownerName, onEdit }: RocketSelectorProps) {
  const fits = rocketFits(design, content)
  const editable = fits[0]
    ? canEdit(seat, { kind: 'rocket', rocketId: fits[0].rocketId }, content)
    : false
  return (
    <div className="min-w-0" data-testid="launcher-body">
      {!editable && <p className="mb-2 text-xs text-subtle">View only: chosen by {ownerName}.</p>}
      <ul className="flex min-w-0 flex-col gap-1.5">
        {fits.map((f) => {
          const rocket = content.rockets.find((r) => r.id === f.rocketId)!
          const selected = design.rocketId === f.rocketId
          return (
            <li key={f.rocketId}>
              <button
                type="button"
                data-testid={`rocket-card-${f.rocketId}`}
                aria-pressed={selected}
                disabled={!editable}
                onClick={() => onEdit({ kind: 'rocket', rocketId: f.rocketId })}
                className={`grid w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 border-2 px-2 py-1 text-left disabled:cursor-not-allowed ${selected ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong'}`}
              >
                <AssetImage
                  kind="sprites"
                  id={rocketSprite(rocket)}
                  label={rocket.name}
                  className="h-10 w-8 object-contain object-bottom"
                />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className="label-caps truncate text-sm text-primary">{rocket.name}</span>
                    <span className="shrink-0 font-mono text-xs whitespace-nowrap text-muted tabular-nums">
                      {compactMoneyM(rocket.costM)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-2">
                    <SegmentBar
                      share={f.capacityKg > 0 ? f.massKg / f.capacityKg : 0}
                      fill={TONE_FILL[FIT_TONE[f.status]]}
                      segments={10}
                      height="h-1.5"
                      className="min-w-0 flex-1"
                    />
                    <span className="shrink-0 font-mono text-xs whitespace-nowrap text-muted tabular-nums">
                      {compactNumber(f.massKg)}/{compactNumber(f.capacityKg)}kg
                    </span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
