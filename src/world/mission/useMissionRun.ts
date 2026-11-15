import { useCallback, useEffect, useRef, useState } from 'react'
import { isEvaOption, resolveEvent } from '@/engine/events'
import { shakeScreen } from '@/ui/feel'
import { playSound } from '@/ui/sound'
import { advanceTurn, dropPending, isMissionOver } from '@/engine/mission'
import { useCrewTask } from './crewTask'
import { useProblems } from './problems'
import type { Design, EngineContent } from '@/engine/types'
import type { GameEvent } from '@/schemas'
import { useStore } from '@/store'
import { emitConcept } from '@/store/concepts'
import type { WorkstationKind } from '../rooms/room'
import { actionPost, rngFor } from './missionRun'
import { isOwnEvent, teammateProposal, type Proposal } from './proposal'

/** Pause between fast-forwarded turns, in ms, so the crew walks and the log can be followed. */
const FF_STEP_MS = 450
/** How long the result line and the "Day X: event!" sting stay up. */
const TOAST_MS = 3500
const STING_MS = 1600
/** Event that teaches dust on solar panels the first time it fires. */
const DUST_STORM_EVENT = 'dust-storm'

export interface Toast {
  id: number
  ok: boolean
  text: string
}

/** A standing order answered an event under signal delay: shown so the player still sees it. */
export interface Notice {
  key: string
  title: string
  optionLabel: string
  success: boolean
}

/** Plays a crew member's action in the room; resolves when they are back at their post. */
export type ActFn = (crewId: string, kind: WorkstationKind) => Promise<void>

/**
 * Drives the mission with the engine. Next Turn; Fast-Forward skips quiet days and stops at the
 * next event. Every event waits for the player: their own as a decision, a teammate's as a
 * proposal to approve or override. Every new state is saved to the store.
 */
export function useMissionRun(
  design: Design | null,
  content: EngineContent,
  act: ActFn,
  /** A lesson or menu is open: fast-forward waits, then carries on. */
  paused = false,
) {
  const run = useStore((s) => s.mission.run)
  const setRun = useStore((s) => s.setRun)
  const [fastForward, setFastForward] = useState(false)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [sting, setSting] = useState<{ day: number; key: number } | null>(null)
  const actRef = useRef(act)
  useEffect(() => {
    actRef.current = act
  }, [act])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!sting) return
    const t = setTimeout(() => setSting(null), STING_MS)
    return () => clearTimeout(t)
  }, [sting])

  const pendingId = run?.pendingEvents[0]?.eventId
  const pending: GameEvent | null =
    (pendingId && content.events.find((e) => e.id === pendingId)) || null
  const over = run ? isMissionOver(run) : false
  const notice = notices[0] ?? null

  const nextTurn = useCallback(() => {
    const s = useStore.getState().mission.run
    if (!s || !design || isMissionOver(s) || s.pendingEvents.length > 0) return
    const { state, newEvents } = advanceTurn(s, design, content, rngFor(s))
    setRun(state)
    // NOVA: the first time dust builds up on the panels.
    if (state.dustLevel > s.dustLevel || newEvents.some((e) => e.id === DUST_STORM_EVENT))
      emitConcept('dust_solar')
    // Standing orders answered something under signal delay: queue it so the player sees it.
    const auto: Notice[] = []
    for (const d of state.decisions.slice(s.decisions.length)) {
      const event = content.events.find((e) => e.id === d.eventId)
      if (!event) continue
      if (d.crewId) void actRef.current(d.crewId, actionPost(event, d.optionId))
      if (d.handledBy === 'standing-orders')
        auto.push({
          key: `${d.eventId}@${d.turn}`,
          title: event.title,
          optionLabel: event.options.find((o) => o.id === d.optionId)?.label ?? d.optionId,
          success: d.success,
        })
    }
    if (auto.length) setNotices((n) => [...n, ...auto])
    // Something happened: stop fast-forward, with a short "Day X: event!" sting.
    if (newEvents.length > 0) {
      useProblems.setState({ dismissed: false, focusUid: null })
      setFastForward(false)
      setSting({ day: state.day, key: state.turnIndex })
      playSound('event-sting')
      shakeScreen('small')
    }
    if (isMissionOver(state)) setFastForward(false)
  }, [design, content, setRun])

  // Fast-forward: one turn every FF_STEP_MS until an event needs the player or the mission ends.
  useEffect(() => {
    if (!fastForward || pending || notice || over || acting || paused) return
    const t = setTimeout(nextTurn, FF_STEP_MS)
    return () => clearTimeout(t)
  }, [fastForward, pending, notice, over, acting, paused, run, nextTurn])

  /** Resolves, plays the walk to the station, then shows the result as a toast. */
  const resolve = useCallback(
    async (
      event: GameEvent,
      optionId: string,
      crewId: string | null,
      handledBy: 'player' | 'ai',
      prefix: string,
      chanceBonus = 0,
    ) => {
      const s = useStore.getState().mission.run
      if (!s || !design) return
      const { state, result } = resolveEvent(
        s,
        event,
        optionId,
        crewId,
        rngFor(s),
        { design, content },
        handledBy,
        prefix,
        chanceBonus,
      )
      if (!result.applied) {
        setToast({ id: Date.now(), ok: false, text: result.explanation })
        return
      }
      setActing(true)
      setRun(state)
      if (crewId) await actRef.current(crewId, actionPost(event, optionId))
      setActing(false)
      const option = event.options.find((o) => o.id === optionId)
      const label = option?.label ?? 'Done'
      playSound(result.success ? 'success' : 'fail')
      if (!result.success && option && isEvaOption(option)) shakeScreen()
      const detail = result.effectsApplied.filter(Boolean).join(', ')
      setToast({
        id: Date.now(),
        ok: result.success,
        text: `${label} ${result.success ? 'succeeded' : 'failed'}${detail ? `: ${detail}` : ''}`,
      })
    },
    [design, content, setRun],
  )

  /** The player's own choice (their event, or an override of a teammate's proposal). */
  const choose = useCallback(
    (event: GameEvent, optionId: string, crewId: string | null, chanceBonus = 0, note?: string) => {
      const own = design ? isOwnEvent(event, design) : true
      const how = own ? 'You' : 'You (override)'
      const prefix = note
        ? `${how}, ${note}: `
        : chanceBonus > 0
          ? `${how}, hands-on repair hit: `
          : `${how}: `
      return resolve(event, optionId, crewId, 'player', prefix, chanceBonus)
    },
    [design, resolve],
  )

  /** The player approved the teammate's proposal. */
  const approve = useCallback(
    (event: GameEvent, p: Proposal) =>
      resolve(
        event,
        p.decision.optionId,
        p.decision.crewId,
        'ai',
        `${p.owner.name} (approved by you): `,
      ),
    [resolve],
  )

  /**
   * Next Turn with problems still pending (after the player confirmed): each goes to the
   * responsible teammate's default choice (crewAI), logged "Not handled by you"; problems nobody
   * can answer are dropped with a log line. Then the turn advances.
   */
  const handOverAndAdvance = useCallback(() => {
    let s = useStore.getState().mission.run
    if (!s || !design) return
    for (const pend of [...s.pendingEvents]) {
      const event = content.events.find((e) => e.id === pend.eventId)
      if (!event) continue
      const prop = teammateProposal(s, event, design, content)
      if (prop) {
        const { state, result } = resolveEvent(
          s,
          event,
          prop.decision.optionId,
          prop.decision.crewId,
          rngFor(s),
          { design, content },
          'ai',
          `Not handled by you. ${prop.owner.name} used the default: `,
        )
        if (result.applied) {
          s = state
          continue
        }
      }
      s = dropPending(s, pend.uid, event.title)
    }
    useCrewTask.getState().set({ active: null, open: false })
    useProblems.setState({ dismissed: false, focusUid: null })
    setRun(s)
    nextTurn()
  }, [design, content, setRun, nextTurn])

  const ackNotice = useCallback(() => setNotices((n) => n.slice(1)), [])

  return {
    run,
    pending,
    notice,
    ackNotice,
    sting,
    over,
    acting,
    fastForward,
    setFastForward,
    nextTurn,
    choose,
    approve,
    handOverAndAdvance,
    toast,
  }
}
