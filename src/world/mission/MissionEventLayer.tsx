import { useEffect, useState } from 'react'
import { useProblems } from './problems'
import { AnimatePresence, motion } from 'motion/react'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { GameEvent } from '@/schemas'
import { successChance } from '@/engine/events'
import { useSettings } from '@/ui/settingsStore'
import { EventPopup } from './EventPopup'
import { RepairTiming } from './RepairTiming'
import { useStore } from '@/store'
import { diyPlan, TASK_LABEL, taskFor, useCrewTask } from './crewTask'
import { isOwnEvent, teammateProposal, type Proposal } from './proposal'
import { ProposalPopup, StandingOrderNotice } from './ProposalPopup'
import type { Notice } from './useMissionRun'

interface Timing {
  event: GameEvent
  optionId: string
  crewId: string | null
  label: string
  chance: number
}

interface MissionEventLayerProps {
  run: MissionState
  design: Design
  content: EngineContent
  pending: GameEvent | null
  notice: Notice | null
  sting: { day: number; key: number } | null
  acting: boolean
  delayMin: number | null
  onChoose: (
    event: GameEvent,
    optionId: string,
    crewId: string | null,
    chanceBonus?: number,
  ) => void
  onApprove: (event: GameEvent, proposal: Proposal) => void
  onAckNotice: () => void
  /** Station kind -> its label in this habitat, e.g. "power" -> "Power & Life Support Panel". */
  stationLabels: Record<string, string>
}

/**
 * Every event stops play and shows here: the player's own as a full decision, a teammate's as
 * their proposal (APPROVE / OVERRIDE), a standing-order answer as a notice with OK.
 */
export function MissionEventLayer(p: MissionEventLayerProps) {
  // Event uid the player chose to decide themselves.
  const [overridden, setOverridden] = useState<string | null>(null)
  // Which pending problem to show: the one clicked in the log, else the oldest.
  const focusUid = useProblems((s) => s.focusUid)
  const dismissed = useProblems((s) => s.dismissed)
  const shown = p.run.pendingEvents.find((e) => e.uid === focusUid) ?? p.run.pendingEvents[0]
  const uid = shown?.uid ?? null
  const ev = (shown && p.content.events.find((e) => e.id === shown.eventId)) || null
  const dismiss = () => useProblems.setState({ dismissed: true })
  // Esc closes the popup; the problem stays pending.
  const popupUp = ev !== null && !dismissed
  useEffect(() => {
    if (!popupUp) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      e.stopPropagation()
      useProblems.setState({ dismissed: true })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [popupUp])
  const proposal =
    ev && !isOwnEvent(ev, p.design) ? teammateProposal(p.run, ev, p.design, p.content) : null
  const decideMyself = ev && (!proposal || overridden === uid)
  // Hands-on task: offered on mapped events you decide yourself; while it runs, no popup.
  const seat = useStore((s) => s.game.roleChoice)
  const activeTask = useCrewTask((s) => s.active)
  const taskRunning = activeTask !== null && activeTask.uid === uid
  const task = ev ? taskFor(ev.id) : undefined
  const plan = ev && task ? diyPlan(p.run, ev, p.design, p.content, seat) : null
  const stationName = (k: string) => p.stationLabels[k] ?? k
  const diy =
    ev && uid && task && plan
      ? {
          label: TASK_LABEL[task.taskType],
          station: stationName(task.station),
          onPick: () =>
            useCrewTask
              .getState()
              .set({ active: { uid, eventId: ev.id, task, plan }, open: false }),
        }
      : undefined
  // Repair options get the timing bar first (unless mini-games are off in Settings).
  const minigamesOn = useSettings((s) => s.minigames)
  const [timing, setTiming] = useState<Timing | null>(null)
  const M = p.content.constants.minigame
  const pick = (event: GameEvent, optionId: string, crewId: string | null) => {
    const option = event.options.find((o) => o.id === optionId)
    const repair = M.eventIds.includes(event.id) && option?.tags.includes(M.optionTag as never)
    if (!minigamesOn || !option || !repair) return p.onChoose(event, optionId, crewId)
    const crew = p.content.crew.find((c) => c.id === crewId) ?? null
    const chance = successChance(p.run, event, option, crew, {
      design: p.design,
      content: p.content,
    })
    setTiming({ event, optionId, crewId, label: option.label, chance })
  }

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
      {timing && (
        <RepairTiming
          key={timing.event.id + timing.optionId}
          label={timing.label}
          chance={timing.chance}
          bonus={M.hitBonus}
          maxChance={M.maxChance}
          durationMs={M.durationMs}
          sweepMs={M.sweepMs}
          minZone={M.minZone}
          onDone={(hit) => {
            setTiming(null)
            p.onChoose(timing.event, timing.optionId, timing.crewId, hit ? M.hitBonus : 0)
          }}
        />
      )}
      {ev && !dismissed && !p.acting && !timing && !taskRunning && decideMyself && (
        <EventPopup
          key={`${uid}-decide`}
          event={ev}
          run={p.run}
          design={p.design}
          content={p.content}
          onChoose={(o, c) => pick(ev, o, c)}
          diy={diy}
          onClose={dismiss}
        />
      )}
      {ev && !dismissed && !p.acting && !taskRunning && !decideMyself && proposal && (
        <ProposalPopup
          key={`${uid}-proposal`}
          event={ev}
          proposal={proposal}
          onApprove={() => p.onApprove(ev, proposal)}
          onOverride={() => setOverridden(uid)}
          onClose={dismiss}
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
