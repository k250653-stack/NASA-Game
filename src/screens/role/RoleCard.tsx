import type { RoleInfo } from '@/schemas'
import { Badge } from '@/ui/Badge'
import { Card } from '@/ui/Card'
import { Icon } from '@/ui/Icon'
import { ROLE_COLOR_CLASS } from '@/ui/roleColors'

interface RoleCardProps {
  role: RoleInfo
  selected: boolean
  onSelect: () => void
}

/** One seat from roles.json: colour, icon, what you control and what you will learn. */
export function RoleCard({ role, selected, onSelect }: RoleCardProps) {
  const c = ROLE_COLOR_CLASS[role.color]
  return (
    <Card
      selected={selected}
      onSelect={onSelect}
      label={role.name}
      testId={`role-card-${role.id}`}
      className={`border-t-4 ${c.topBorder}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex size-9 items-center justify-center rounded-md border ${c.border} ${c.bg} ${c.text}`}
        >
          <Icon name={role.icon} size={20} />
        </span>
        <h2 className="font-display text-lg leading-tight font-bold text-primary">{role.name}</h2>
      </div>
      {role.sandbox && (
        <Badge variant="warning" className="mt-2 self-start">
          Sandbox
        </Badge>
      )}
      <p className="mt-2 text-sm text-muted">{role.summary}</p>
      <h3 className="mt-3 text-xs font-semibold tracking-wide text-subtle uppercase">
        You control
      </h3>
      <ul className="mt-1 list-inside list-disc text-sm text-primary">
        {role.controls.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h3 className="mt-3 text-xs font-semibold tracking-wide text-subtle uppercase">
        You'll learn about
      </h3>
      <ul className="mt-1 list-inside list-disc text-sm text-muted">
        {role.learn.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {role.note && <p className={`mt-3 text-sm ${c.text}`}>{role.note}</p>}
      <p className="mt-auto pt-3 text-xs text-subtle">{role.difficultyHint}</p>
    </Card>
  )
}
