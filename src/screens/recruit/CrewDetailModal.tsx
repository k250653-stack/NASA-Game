import { SKILL_KEYS, type CrewMember } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { InfoTip } from '@/ui/InfoTip'
import { ROLE_LABEL, SKILL_LABEL } from '@/ui/labels'
import { Panel } from '@/ui/Panel'
import { SkillBar } from '@/ui/SkillBar'
import { PrioritiesBar } from './PrioritiesBar'

interface CrewDetailPanelProps {
  member: CrewMember
  recruited: boolean
  /** Why this candidate cannot be recruited right now (from the engine), if anything. */
  blockedReason?: string
  /** Who would be swapped out, if recruiting replaces someone. */
  replaces?: string
  onRecruit: () => void
  onRemove: () => void
  onClose: () => void
}

/** The selected candidate's file, in the side column: key facts up front, the rest behind "i". */
export function CrewDetailPanel({
  member,
  recruited,
  blockedReason,
  replaces,
  onRecruit,
  onRemove,
  onClose,
}: CrewDetailPanelProps) {
  return (
    <Panel
      title={member.name}
      testId="crew-detail"
      actions={
        <button
          type="button"
          onClick={onClose}
          aria-label="Close crew file"
          className="text-muted hover:text-primary"
        >
          <Icon name="IconX" size={18} />
        </button>
      }
    >
      <div className="flex gap-3">
        <AssetImage
          kind="portraits"
          id={member.portrait}
          label={member.name}
          className="size-24 shrink-0 border-2 border-border-strong"
        />
        <div className="min-w-0 space-y-1.5">
          <p className="label-caps text-sm text-muted">{ROLE_LABEL[member.role]}</p>
          <div className="flex flex-wrap gap-1">
            {member.traits.map((t) => (
              <Badge key={t} variant={t} />
            ))}
          </div>
          <p className="font-mono text-primary tabular-nums">${member.salaryM}M</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        <li className="flex gap-2 text-primary">
          <Icon name="IconPlus" size={16} className="mt-0.5 shrink-0 text-success" />
          {member.strength.text}
        </li>
        <li className="flex gap-2 text-muted">
          <Icon name="IconMinus" size={16} className="mt-0.5 shrink-0 text-danger" />
          {member.weakness.text}
        </li>
      </ul>
      <div className="mt-3 grid grid-cols-5 gap-x-2">
        {SKILL_KEYS.map((k) => (
          <SkillBar key={k} label={SKILL_LABEL[k]} level={member.skills[k]} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="label-caps text-xs text-subtle">Background & priorities</span>
        <InfoTip label={`${member.name}: background`}>
          <span className="block">{member.backstory}</span>
          <span className="mt-2 block">
            <PrioritiesBar priorities={member.priorities} />
          </span>
        </InfoTip>
      </div>
      {blockedReason && !recruited && <p className="mt-3 text-sm text-alert">{blockedReason}</p>}
      <div className="mt-4 flex justify-end">
        {recruited ? (
          <Button variant="danger" onClick={onRemove}>
            Remove from team
          </Button>
        ) : (
          <Button onClick={onRecruit} disabled={blockedReason !== undefined}>
            {replaces ? `Recruit (replaces ${replaces})` : 'Recruit'}
          </Button>
        )}
      </div>
    </Panel>
  )
}
