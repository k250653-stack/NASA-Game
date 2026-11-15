import { POLL_AREAS } from '@/engine/launchPoll'
import type { Check, CheckId, CheckStatus } from '@/engine/types'
import { ROLES, type Role } from '@/schemas'
import { Button } from '@/ui/Button'
import { InfoTip } from '@/ui/InfoTip'
import { ROLE_LABEL } from '@/ui/labels'
import { Panel } from '@/ui/Panel'
import { roleClasses } from '@/ui/roleColors'
import { FIX_TARGET } from './fixTargets'

const MARK: Record<CheckStatus, { sign: string; className: string }> = {
  ok: { sign: '✓', className: 'border-success text-success' },
  warn: { sign: '!', className: 'border-alert text-alert' },
  fail: { sign: '✗', className: 'border-danger text-danger' },
}

interface LaunchChecklistProps {
  checks: readonly Check[]
  onFix: (id: CheckId) => void
}

/** Simple rows (✓ / ! / ✗) grouped by seat; each explanation sits behind an "i". */
export function LaunchChecklist({ checks, onFix }: LaunchChecklistProps) {
  const groups = ROLES.map((role: Role) => ({
    role,
    items: checks.filter((c) => POLL_AREAS[role].includes(c.id)),
  })).filter((g) => g.items.length > 0)
  return (
    <Panel title="Launch checklist" subtitle="Fails block launch; warnings need your confirmation">
      <div className="flex flex-col gap-4">
        {groups.map(({ role, items }) => (
          <section key={role}>
            <h3 className={`label-caps text-sm ${roleClasses(role).text}`}>{ROLE_LABEL[role]}</h3>
            <ul className="mt-1">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 py-1"
                  data-testid={`check-${c.id}`}
                  data-status={c.status}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center border-2 font-mono text-sm ${MARK[c.status].className}`}
                    aria-label={c.status}
                  >
                    {MARK[c.status].sign}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">{c.label}</span>
                  <InfoTip label={`${c.label}: details`}>{c.explanation}</InfoTip>
                  {c.status !== 'ok' && (
                    <Button
                      size="sm"
                      variant="secondary"
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
      </div>
    </Panel>
  )
}
