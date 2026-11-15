import { useEffect } from 'react'
import type { GameEvent } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Button } from '@/ui/Button'
import { ROLE_LABEL } from '@/ui/labels'
import { playSound } from '@/ui/sound'
import { PopupPanel } from '../PopupPanel'
import type { Proposal } from './proposal'

interface ProposalPopupProps {
  event: GameEvent
  proposal: Proposal
  onApprove: () => void
  onOverride: () => void
  onClose?: () => void
}

/** A teammate's event: their plan in one line; APPROVE (Enter) or OVERRIDE to choose yourself. */
export function ProposalPopup({
  event,
  proposal,
  onApprove,
  onOverride,
  onClose,
}: ProposalPopupProps) {
  const { owner, decision, optionLabel, actor } = proposal
  useEffect(() => {
    playSound(event.urgency === 'urgent' ? 'alarm' : 'radio')
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented) return
      e.preventDefault()
      onApprove()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [event.id, event.urgency, onApprove])
  return (
    <PopupPanel section="Event" title={event.title} onClose={onClose}>
      <div
        className="mx-auto max-w-4xl px-6 py-6"
        data-testid="proposal-popup"
        data-event={event.id}
      >
        <AssetImage
          kind="events"
          id={`event-${event.id}`}
          label={event.title}
          className="mx-auto mb-4 block h-[240px] w-[480px] border-2 border-border-strong"
        />
        <p className="label-caps text-sm text-alert">
          {ROLE_LABEL[event.role]} · {event.urgency}
        </p>
        <p className="mt-1 text-base text-primary">{event.description}</p>
        <div className="mt-5 flex gap-4 border-t-2 border-border pt-4">
          <AssetImage
            kind="portraits"
            id={owner.portrait}
            label={owner.name}
            className="size-16 shrink-0 border-2 border-border-strong"
          />
          <div className="min-w-0">
            <p className="label-caps text-sm text-accent">
              {owner.name} ({ROLE_LABEL[owner.role]}) proposes
            </p>
            <p className="mt-1 text-lg text-primary" data-testid="proposal-text">
              {optionLabel}
              {actor && <span className="text-muted"> with {actor.name}</span>}
              <span className="font-mono text-sm text-accent tabular-nums">
                {' '}
                · {Math.round(decision.chance * 100)}%
              </span>
            </p>
            <p className="mt-1 text-sm text-muted">Because: {decision.reason}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onOverride} data-testid="override-proposal">
            Override
          </Button>
          <Button onClick={onApprove} data-testid="approve-proposal">
            Approve ↵
          </Button>
        </div>
      </div>
    </PopupPanel>
  )
}

interface NoticeProps {
  title: string
  optionLabel: string
  success: boolean
  delayMin: number | null
  onOk: () => void
}

/** Signal delay: a standing order already answered this; the player still sees what happened. */
export function StandingOrderNotice({ title, optionLabel, success, delayMin, onOk }: NoticeProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented) return
      e.preventDefault()
      onOk()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOk])
  return (
    <PopupPanel section="Standing order" title={title}>
      <div className="mx-auto max-w-3xl px-6 py-8" data-testid="standing-order-notice">
        <p className="text-base text-muted">
          Your orders take {delayMin !== null ? `${delayMin.toFixed(1)} min` : 'minutes'} to reach
          the crew, so they followed your standing orders.
        </p>
        <p className="mt-3 text-lg text-primary">
          <span className="label-caps text-accent">Standing order handled this: </span>
          {optionLabel}{' '}
          <span className={success ? 'text-success' : 'text-danger'}>{success ? '✓' : '✗'}</span>
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={onOk} data-testid="notice-ok">
            OK ↵
          </Button>
        </div>
      </div>
    </PopupPanel>
  )
}
