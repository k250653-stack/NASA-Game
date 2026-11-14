import { SKILL_KEYS, type CrewMember } from '@/schemas'
import { AssetImage } from './AssetImage'
import { Badge } from './Badge'
import { Card } from './Card'
import { Icon } from './Icon'
import { SkillBar } from './SkillBar'
import { ROLE_LABEL, SKILL_LABEL } from './labels'

interface CrewCardProps {
  member: CrewMember
  selected?: boolean
  onSelect?: () => void
  disabled?: boolean
}

export function CrewCard({ member, selected, onSelect, disabled }: CrewCardProps) {
  return (
    <Card
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      label={onSelect ? `${member.name}, ${ROLE_LABEL[member.role]}` : undefined}
    >
      <div className="flex gap-3">
        <AssetImage
          kind="portraits"
          id={member.portrait}
          label={member.name}
          className="size-16 shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold text-primary">
            {member.name}
          </h3>
          <p className="text-xs text-muted">{ROLE_LABEL[member.role]}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {member.traits.map((t) => (
              <Badge key={t} variant={t} />
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] tracking-wider text-subtle uppercase">Salary</div>
          <div className="font-mono text-sm text-primary tabular-nums">
            ${member.salaryM.toFixed(1)}M
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        <li className="flex gap-2 text-primary">
          <Icon name="IconPlus" size={16} className="mt-0.5 shrink-0 text-success" />
          <span>{member.strength.text}</span>
        </li>
        <li className="flex gap-2 text-muted">
          <Icon name="IconMinus" size={16} className="mt-0.5 shrink-0 text-danger" />
          <span>{member.weakness.text}</span>
        </li>
      </ul>

      <div className="mt-3 grid grid-cols-5 gap-x-4 border-t border-border pt-3">
        {SKILL_KEYS.map((k) => (
          <SkillBar key={k} label={SKILL_LABEL[k]} level={member.skills[k]} />
        ))}
      </div>
    </Card>
  )
}
