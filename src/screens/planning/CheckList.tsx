import type { Check, CheckStatus } from '@/engine/types'
import { Badge, type BadgeVariant } from '@/ui/Badge'

const STATUS_BADGE: Record<CheckStatus, BadgeVariant> = {
  ok: 'success',
  warn: 'warning',
  fail: 'danger',
}

export function CheckList({ checks }: { checks: readonly Check[] }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
          <Badge variant={STATUS_BADGE[c.status]} className="mt-0.5 w-12 shrink-0 justify-center">
            {c.status}
          </Badge>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{c.label}</p>
            <p className="text-sm text-muted">{c.explanation}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
