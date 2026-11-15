import type { CrewMember } from '@/schemas'
import { AssetImage } from './AssetImage'
import { Badge } from './Badge'
import { Card } from './Card'
import { ROLE_LABEL } from './labels'
import { roleClasses } from './roleColors'

interface CrewCardProps {
  member: CrewMember
  selected?: boolean
  onSelect?: () => void
  disabled?: boolean
  /** Small marker for crew already on the team. */
  recruited?: boolean
}

/** Portrait-first crew card: big portrait, role stripe, name, two trait tags, salary. */
export function CrewCard({ member, selected, onSelect, disabled, recruited }: CrewCardProps) {
  const role = roleClasses(member.role)
  return (
    <Card
      testId={`crew-card-${member.id}`}
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      padded={false}
      label={onSelect ? `${member.name}, ${ROLE_LABEL[member.role]}` : undefined}
    >
      <div className={`border-t-4 ${role.topBorder}`}>
        <div className="relative">
          <AssetImage
            kind="portraits"
            id={member.portrait}
            label={member.name}
            className="aspect-square w-full object-cover [image-rendering:pixelated]"
          />
          {recruited && (
            <span className="label-caps absolute top-1.5 left-1.5 bg-success px-1.5 text-xs text-bg">
              On team
            </span>
          )}
        </div>
        <div className="space-y-1.5 px-3 py-2.5">
          <h3 className="label-caps truncate text-base text-primary">{member.name}</h3>
          <p className={`label-caps text-xs ${role.text}`}>{ROLE_LABEL[member.role]}</p>
          <div className="flex items-center gap-1">
            {member.traits.slice(0, 2).map((t) => (
              <Badge key={t} variant={t} />
            ))}
            <span className="ml-auto font-mono text-sm text-primary tabular-nums">
              ${member.salaryM.toFixed(1)}M
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
