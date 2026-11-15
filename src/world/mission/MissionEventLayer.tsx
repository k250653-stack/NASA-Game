import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { GameEvent } from '@/schemas'
import { EventPopup } from './EventPopup'
import { isOwnEvent, teammateProposal, type Proposal } from './proposal'
import { ProposalPopup, StandingOrderNotice } from './ProposalPopup'
import type { Notice } from './useMissionRun'

interface MissionEventLayerProps {
  run: MissionState
  design: Design
  content: EngineContent
  pending: GameEvent | null
  notice: Notice | null
  sting: { day: number; key: number } | null
  acting: boolean
  delayMin: number | null
  onChoose: (event: GameEvent, optionId: string, crewId: string | null) => void
  onApprove: (event: GameEvent, proposal: Proposal) => void
  onAckNotice: () => void
}

/**
 * Every event stops play and shows here: the player's own as a full decision, a teammate's as
 * their proposal (APPROVE / OVERRIDE), a standing-order answer as a notice with OK.
 */
export function MissionEventLayer(p: MissionEventLayerProps) {
  // Event uid the player chose to decide themselves.
  const [overridden, setOverridden] = useState<string | null>(null)
  const uid = p.run.pendingEvents[0]?.uid ?? null
  const ev = p.pending
  const proposal =
    ev && !isOwnEvent(ev, p.design) ? teammateProposal(p.run, ev, p.design, p.content) : null
  const decideMyself = ev && (!proposal || overridden === uid)

  return (
    <>
      <AnimatePresence>
        {p.sting && (
          <motion.p
            key={p.sting.key}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="label-caps pointer-events-none fixed top-20 left-1/2 z-[45] -translate-x-1/2 border-2 border-alert bg-bg px-4 py-1.5 text-2xl tracking-[0.25em] text-alert"
            data-testid="event-sting"
          >
            Day {p.sting.day}: event!
          </motion.p>
        )}
      </AnimatePresence>
      {ev && !p.acting && decideMyself && (
        <EventPopup
          key={`${uid}-decide`}
          event={ev}
          run={p.run}
          design={p.design}
          content={p.content}
          onChoose={(o, c) => p.onChoose(ev, o, c)}
        />
      )}
      {ev && !p.acting && !decideMyself && proposal && (
        <ProposalPopup
          key={`${uid}-proposal`}
          event={ev}
          proposal={proposal}
          onApprove={() => p.onApprove(ev, proposal)}
          onOverride={() => setOverridden(uid)}
        />
      )}
      {!ev && !p.acting && p.notice && (
        <StandingOrderNotice
          key={p.notice.key}
          title={p.notice.title}
          optionLabel={p.notice.optionLabel}
          success={p.notice.success}
          delayMin={p.delayMin}
          onOk={p.onAckNotice}
        />
      )}
    </>
  )
}
