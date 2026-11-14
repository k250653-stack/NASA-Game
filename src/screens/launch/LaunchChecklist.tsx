import { POLL_AREAS } from '@/engine/launchPoll'
import type { Check, CheckId, CheckStatus } from '@/engine/types'
import { FIX_TARGET } from './fixTargets'
import { ROLES, type Role } from '@/schemas'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { ROLE_LABEL } from '@/ui/labels'
import { Panel } from '@/ui/Panel'
import { roleClasses } from '@/ui/roleColors'

const BADGE: Record<CheckStatus, 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  warn: 'warning',
  fail: 'danger',
}

interface LaunchChecklistProps {
  checks: readonly Check[]
  onFix: (id: CheckId) => void
}

/** The launch checks grouped by the seat that answers for them. */
export function LaunchChecklist({ checks, onFix }: LaunchChecklistProps) {
  const groups = ROLES.map((role: Role) => ({
    role,
    items: checks.filter((c) => POLL_AREAS[role].includes(c.id)),
  })).filter((g) => g.items.length > 0)
  return (
    <Panel
      title="Launch checklist"
      subtitle="Fails block launch; warnings need your confirmation"
      padded={false}
    >
      {groups.map(({ role, items }) => (
        <section key={role} className="border-b border-border last:border-b-0">
          <h3
            className={`px-4 pt-3 text-xs font-semibold tracking-wide uppercase ${roleClasses(role).text}`}
          >
            {ROLE_LABEL[role]}
          </h3>
          <ul>
            {items.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-3 px-4 py-2.5"
                data-testid={`check-${c.id}`}
                data-status={c.status}
              >
                <Badge variant={BADGE[c.status]} className="mt-0.5 w-12 shrink-0 justify-center">
                  {c.status}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary">{c.label}</p>
                  <p className="text-sm text-muted">{c.explanation}</p>
                </div>
                {c.status !== 'ok' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onFix(c.id)}
                    data-testid={`fix-${c.id}`}
                  >
                    Fix in {FIX_TARGET[c.id].phase === 'recruit' ? 'Recruit' : 'Planning'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Panel>
  )
}
