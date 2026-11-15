import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveEvent } from '@/engine/events'
import { advanceTurn, isMissionOver } from '@/engine/mission'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { GameEvent } from '@/schemas'
import { useStore } from '@/store'
import { emitConcept } from '@/store/concepts'
import type { WorkstationKind } from '../rooms/room'
import { actionPost, rngFor } from './missionRun'

/** Pause between fast-forwarded turns, in ms, so the crew walks and the log can be followed. */
const FF_STEP_MS = 450
/** How long the result line stays up. */
const TOAST_MS = 3500
/** Event that teaches dust on solar panels the first time it fires. */
const DUST_STORM_EVENT = 'dust-storm'

export interface Toast {
  id: number
  ok: boolean
  text: string
}

/** Plays a crew member's action in the room; resolves when they are back at their post. */
export type ActFn = (crewId: string, kind: WorkstationKind) => Promise<void>

/**
 * Drives the mission with the engine: Next Turn, Fast-Forward (stops when the player is needed
 * or the mission ends) and the player's answers. Every new state is saved to the store.
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
  const actRef = useRef(act)
  useEffect(() => {
    actRef.current = act
  }, [act])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  const pendingId = run?.pendingEvents[0]?.eventId
  const pending: GameEvent | null =
    (pendingId && content.events.find((e) => e.id === pendingId)) || null
  const over = run ? isMissionOver(run) : false

  /** Crew who answered events since `before` walk to where they acted. */
  const playDecisions = useCallback(
    (before: MissionState, after: MissionState) => {
      for (const d of after.decisions.slice(before.decisions.length)) {
        const event = content.events.find((e) => e.id === d.eventId)
        if (event && d.crewId && d.handledBy !== 'player')
          void actRef.current(d.crewId, actionPost(event, d.optionId))
      }
    },
    [content],
  )

  const nextTurn = useCallback(() => {
    const s = useStore.getState().mission.run
    if (!s || !design || isMissionOver(s) || s.pendingEvents.length > 0) return
    const { state, newEvents } = advanceTurn(s, design, content, rngFor(s))
    setRun(state)
    // NOVA: the first time dust builds up on the panels.
    if (state.dustLevel > s.dustLevel || newEvents.some((e) => e.id === DUST_STORM_EVENT))
      emitConcept('dust_solar')
    // Fast-forward stops when the player is needed or the mission ends.
    if (state.pendingEvents.length > 0 || isMissionOver(state)) setFastForward(false)
    playDecisions(s, state)
  }, [design, content, setRun, playDecisions])

  // Fast-forward: one turn every FF_STEP_MS until an event needs the player or the mission ends.
  useEffect(() => {
    if (!fastForward || pending || over || acting || paused) return
    const t = setTimeout(nextTurn, FF_STEP_MS)
    return () => clearTimeout(t)
  }, [fastForward, pending, over, acting, paused, run, nextTurn])

  /** The player's answer: resolve, close the popup, play the action, then show the result. */
  const choose = useCallback(
    async (event: GameEvent, optionId: string, crewId: string | null) => {
      const s = useStore.getState().mission.run
      if (!s || !design) return
      const { state, result } = resolveEvent(
        s,
        event,
        optionId,
        crewId,
        rngFor(s),
        { design, content },
        'player',
      )
      if (!result.applied) {
        setToast({ id: Date.now(), ok: false, text: result.explanation })
        return
      }
      setActing(true)
      setRun(state)
      if (crewId) await actRef.current(crewId, actionPost(event, optionId))
      setActing(false)
      const label = event.options.find((o) => o.id === optionId)?.label ?? 'Done'
      const detail = result.effectsApplied.filter(Boolean).join(', ')
      setToast({
        id: Date.now(),
        ok: result.success,
        text: result.success ? label : `${label} failed${detail ? `: ${detail}` : ''}`,
      })
    },
    [design, content, setRun],
  )

  return { run, pending, over, acting, fastForward, setFastForward, nextTurn, choose, toast }
}
