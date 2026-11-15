import { planningGauges, suggestFixes, type Suggestion } from '@/engine/planningHints'
import type { Design, EngineContent } from '@/engine/types'
import type { Role } from '@/schemas'
import { Button } from '@/ui/Button'
import { compactMoneyM, compactNumber } from '@/ui/compactNumber'
import { ResourceBar } from '@/ui/ResourceBar'

interface MarginsColumnProps {
  design: Design
  content: EngineContent
  hintsEnabled: boolean
  ownerName: (role: Role) => string
  /** Applies a suggestion the player owns. */
  canApply: (s: Suggestion) => boolean
  onApply: (s: Suggestion) => void
}

/**
 * Right column body: compact resource bars (the title attribute is the launch check sentence),
 * then the fixes the engine suggests, listed directly with no button needed.
 */
export function MarginsColumn({
  design,
  content,
  hintsEnabled,
  ownerName,
  canApply,
  onApply,
}: MarginsColumnProps) {
  const gauges = planningGauges(design, content)
  const fixes = hintsEnabled ? suggestFixes(design, content) : null

  return (
    <div className="flex min-w-0 flex-col gap-3" id="panel-margins" tabIndex={-1}>
      <section className="pixel-panel min-w-0 p-3" aria-label="Resources">
        <h2 className="label-caps mb-2 text-base text-primary">Resources</h2>
        <div className="flex flex-col gap-2.5" data-testid="margins">
          {gauges.map((g) => (
            <div
              key={g.id}
              tabIndex={0}
              title={g.explanation}
              data-testid={`gauge-${g.id}`}
              data-status={g.status}
              className="min-w-0"
            >
              <ResourceBar
                label={g.label}
                icon={g.icon}
                value={g.value}
                max={g.max}
                unit={g.unit === '$M' ? undefined : g.unit}
                format={g.unit === '$M' ? compactMoneyM : g.unit === 'GB/day' ? undefined : compactNumber}
                status={g.status}
                decimals={g.unit === 'GB/day' ? 1 : 0}
              />
            </div>
          ))}
        </div>
      </section>
      {fixes !== null && (
        <section className="pixel-panel min-w-0 p-3" aria-label="Fixes" data-testid="fixes">
          <h2 className="label-caps mb-2 text-base text-primary">Fixes</h2>
          {fixes.length === 0 ? (
            <p className="text-sm text-success">Within mass and budget limits: nothing to fix.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {fixes.map((h) => (
                <li key={h.text} className="min-w-0 text-sm">
                  <p className="text-primary">{h.text}</p>
                  {canApply(h) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-1"
                      onClick={() => onApply(h)}
                    >
                      Apply
                    </Button>
                  ) : (
                    <p className="mt-0.5 text-xs text-subtle">Ask {ownerName(h.owner)} in a trade.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
