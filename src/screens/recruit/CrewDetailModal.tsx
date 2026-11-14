import { SKILL_KEYS, type CrewMember } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { ROLE_LABEL, SKILL_LABEL } from '@/ui/labels'
import { Modal } from '@/ui/Modal'
import { SkillBar } from '@/ui/SkillBar'
import { PrioritiesBar } from './PrioritiesBar'

interface CrewDetailModalProps {
  member: CrewMember | null
  recruited: boolean
  /** Why this candidate cannot be recruited right now (from the engine), if anything. */
  blockedReason?: string
  /** Who would be swapped out, if recruiting replaces someone. */
  replaces?: string
  onRecruit: () => void
  onRemove: () => void
  onClose: () => void
}

export function CrewDetailModal({
  member,
  recruited,
  blockedReason,
  replaces,
  onRecruit,
  onRemove,
  onClose,
}: CrewDetailModalProps) {
  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      title={member ? member.name : ''}
      size="lg"
      footer={
        member && (
          <>
            {blockedReason && !recruited && (
              <span className="mr-auto self-center text-sm text-alert">{blockedReason}</span>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {recruited ? (
              <Button variant="danger" onClick={onRemove}>
                Remove from team
              </Button>
            ) : (
              <Button onClick={onRecruit} disabled={blockedReason !== undefined}>
                {replaces ? `Recruit (replaces ${replaces})` : 'Recruit'}
              </Button>
            )}
          </>
        )
      }
    >
      {member && (
        <div className="grid grid-cols-[12rem_minmax(0,1fr)] gap-5">
          <AssetImage
            kind="portraits"
            id={member.portrait}
            label={member.name}
            className="size-48 rounded-lg"
          />
          <div>
            <p className="text-sm text-muted">{ROLE_LABEL[member.role]}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {member.traits.map((t) => (
                <Badge key={t} variant={t} />
              ))}
              <span className="ml-auto font-mono text-primary tabular-nums">
                ${member.salaryM}M
              </span>
            </div>
            <p className="mt-3 text-primary">{member.backstory}</p>
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
          </div>
          <div className="col-span-2 grid grid-cols-5 gap-x-4 border-t border-border pt-4">
            {SKILL_KEYS.map((k) => (
              <SkillBar key={k} label={SKILL_LABEL[k]} level={member.skills[k]} />
            ))}
          </div>
          <div className="col-span-2">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
              Priorities
            </p>
            <PrioritiesBar priorities={member.priorities} />
          </div>
        </div>
      )}
    </Modal>
  )
}
