import { useState } from 'react'
import { planningGauges, suggestFixes, type Suggestion } from '@/engine/planningHints'
import type { Design, EngineContent } from '@/engine/types'
import type { Role } from '@/schemas'
import { Button } from '@/ui/Button'
import { Panel } from '@/ui/Panel'
import { ResourceBar } from '@/ui/ResourceBar'
import { Tooltip } from '@/ui/Tooltip'

interface MarginsColumnProps {
  design: Design
  content: EngineContent
  hintsEnabled: boolean
  ownerName: (role: Role) => string
  /** Applies a suggestion the player owns. */
  canApply: (s: Suggestion) => boolean
  onApply: (s: Suggestion) => void
}

/** Live margins from the engine; each bar's tooltip is the launch check sentence. */
export function MarginsColumn({
  design,
  content,
  hintsEnabled,
  ownerName,
  canApply,
  onApply,
}: MarginsColumnProps) {
  const gauges = planningGauges(design, content)
  const [hints, setHints] = useState<Suggestion[] | null>(null)

  return (
    <Panel
      id="panel-margins"
      title="Resources"
      subtitle="Hover or focus a bar for the details."
      actions={
        hintsEnabled ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setHints(suggestFixes(design, content))}
            data-testid="hint-button"
          >
            Fixes
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4" data-testid="margins">
        {gauges.map((g) => (
          <Tooltip key={g.id} content={g.explanation} side="bottom">
            <div tabIndex={0} data-testid={`gauge-${g.id}`} data-status={g.status}>
              <ResourceBar
                label={g.label}
                icon={g.icon}
                value={g.value}
                max={g.max}
                unit={g.unit}
                status={g.status}
                decimals={g.unit === 'GB/day' ? 1 : 0}
              />
            </div>
          </Tooltip>
        ))}
      </div>
      {hints !== null && (
        <div className="mt-4 border-t-2 border-border pt-3">
          {hints.length === 0 ? (
            <p className="text-sm text-success">Within mass and budget limits: nothing to fix.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {hints.map((h) => (
                <li key={h.text} className="text-sm">
                  <p className="text-primary">{h.text}</p>
                  {canApply(h) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-1"
                      onClick={() => {
                        onApply(h)
                        setHints(null)
                      }}
                    >
                      Apply
                    </Button>
                  ) : (
                    <p className="mt-1 text-xs text-subtle">Ask {ownerName(h.owner)} in a trade.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  )
}
