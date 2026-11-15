import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { usePlanning } from '@/screens/planning/usePlanning'
import { useStore } from '@/store'
import { NovaCompanion } from '@/nova/NovaCompanion'
import { useHints } from '@/nova/tutorial'
import { runKey, TASK_LABEL, useCrewTask, useTaskStats } from './mission/crewTask'
import { ProblemButtons, ProblemLogPanel } from './mission/ProblemLog'
import { problemLog, reopenProblem, useProblems } from './mission/problems'
import { alertCategory, setAlert } from '@/ui/alertLayer'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { TaskList, TaskPanel } from './mission/TaskPanel'
import { skipTutorial, useNova } from '@/nova/novaStore'
import { useHabitatTutorial } from '@/nova/tutorial'
import { emitConcept } from '@/store/concepts'
import { computeScore } from '@/engine/score'
import { shakeScreen } from '@/ui/feel'
import { setTension } from '@/ui/sound'
import { returnToEarth } from './debrief/debrief'
import { HabitatCanvas } from './HabitatCanvas'
import type { HabitatCallbacks, HabitatScene, HabitatTarget, NpcSpec } from './HabitatScene'
import { InteractPrompt, promptTransform } from './InteractPrompt'
import { MissionEventLayer } from './mission/MissionEventLayer'
import { MissionEndCard } from './mission/MissionEndCard'
import {
  DayBadge,
  GaugeStrip,
  HudFrame,
  MissionLog,
  ResultToast,
  TurnControls,
} from './mission/MissionHud'
import { dayInfo, gauges, ROLE_POST, ROLE_TOKEN } from './mission/missionRun'
import { StationPopup } from './mission/StationPopup'
import { attention } from './mission/stationStatus'
import { CrewStatusPopup } from './mission/StatusPopups'
import { useMissionRun } from './mission/useMissionRun'
import { useReleaseFocus } from './useReleaseFocus'
import { PauseMenu, type PauseState } from './PauseMenu'
import { getRoom, type WorkstationKind } from './rooms/room'

/** After the mission ends: a beat in the room, then the title card, then the debrief. */
/** NOVA's one-line tip for the first hands-on task. */
const DIY_TIP = 'You can fix this yourself. Walk to the glowing station and press E.'
const END_PAUSE_MS = 1200
const END_CARD_MS = 2800
/** Event that shakes the screen when it hits. */
const IMPACT_EVENT = 'micrometeoroid-hit'

type Popup = { kind: 'crew'; id: string } | { kind: 'station'; key: WorkstationKind } | null

/** Phase "mission": the run plays out in the habitat with the crew at their posts. */
export default function HabitatWorld() {
  const p = usePlanning()
  const setPhase = useStore((s) => s.setPhase)
  const sceneRef = useRef<HabitatScene | null>(null)
  const act = useCallback(
    (id: string, kind: WorkstationKind) => sceneRef.current?.act(id, kind) ?? Promise.resolve(),
    [],
  )
  const [menu, setMenu] = useState<PauseState>(null)
  const novaOpen = useNova((s) => s.openLessonId !== null || s.codexOpen)
  const [popup, setPopup] = useState<Popup>(null)
  // A lesson, the pause menu or a station popup holds fast-forward until it closes.
  const m = useMissionRun(p.design, p.content, act, novaOpen || menu !== null || popup !== null)
  const [target, setTarget] = useState<HabitatTarget | null>(null)
  const trades = useStore((s) => s.design.tradesAccepted)
  const [ending, setEnding] = useState(false)
  const promptRef = useRef<HTMLDivElement>(null)
  const anchor = useRef({ x: 0, y: 0 })
  const live = useRef(false)
  const activeTask = useCrewTask((s) => s.active)
  const problemsDismissed = useProblems((s) => s.dismissed)
  const logOpen = useProblems((s) => s.logOpen)
  const [confirmNext, setConfirmNext] = useState(false)
  const taskOpen = useCrewTask((s) => s.open)
  const paused =
    popup !== null ||
    menu !== null ||
    (m.pending !== null && activeTask === null && !problemsDismissed) ||
    logOpen ||
    confirmNext ||
    taskOpen ||
    m.notice !== null ||
    ending ||
    novaOpen
  // Popups closing must always hand the keyboard back to the player.
  useReleaseFocus(paused)
  const tutorial = useHabitatTutorial(paused)
  // NOVA: the first arrival somewhere without live contact with Earth (Mars).
  const destinationId = p.destination?.id
  useEffect(() => {
    if (
      destinationId &&
      !p.content.constants.settings.liveResponseDestinations.includes(destinationId)
    )
      emitConcept('signal_delay')
  }, [destinationId, p.content])
  useEffect(() => {
    live.current = paused
  }, [paused])

  // Stations needing attention get a pulsing "!" in the room.
  const scenario = p.content.scenarios.find((s) => s.id === p.design?.scenarioId)
  const scienceTarget = scenario?.scienceTarget ?? 1
  const alerts = useMemo(
    () =>
      m.run && p.design
        ? attention(m.run, p.design, p.content, gauges(m.run, p.design, p.content, scienceTarget))
        : [],
    [m.run, p.design, p.content, scienceTarget],
  )
  const alertsRef = useRef(alerts)
  // "!" over the crew member whose role the open event belongs to (Mission Director games).
  const pendingRole = m.pending?.role
  const crewAlertRef = useRef<string[]>([])
  useEffect(() => {
    crewAlertRef.current = p.team.filter((c) => c.role === pendingRole).map((c) => c.id)
  }, [p.team, pendingRole])
  // Tension music while an urgent event is open, then back to the mission track.
  const urgentOpen = m.pending?.urgency === 'urgent'
  useEffect(() => {
    setTension(urgentOpen)
    return () => setTension(false)
  }, [urgentOpen])
  // Feel: impacts shake the screen; power events make the lights flicker.
  const turns = m.run?.turnHistory.length ?? 0
  useEffect(() => {
    const last = useStore.getState().mission.run?.turnHistory.at(-1)
    if (!last || turns === 0) return
    const fired = last.eventIds.map((id) => p.content.events.find((e) => e.id === id))
    if (fired.some((e) => e?.id === IMPACT_EVENT)) shakeScreen()
    if (fired.some((e) => e?.role === 'power_life')) sceneRef.current?.flicker()
  }, [turns, p.content])
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])

  const room = getRoom(p.destination?.id === 'mars' ? 'mars-habitat' : 'moon-habitat')
  const stationLabels = Object.fromEntries(room.workstations.map((w) => [w.kind, w.label]))
  const stationLabel = (k: string) => stationLabels[k] ?? k
  // Alert layer: plays while anything is pending, in the first problem's category.
  const firstPending = m.run?.pendingEvents[0]?.eventId ?? null
  useEffect(() => {
    void setAlert(firstPending ? alertCategory(firstPending) : null)
  }, [firstPending])
  useEffect(() => () => void setAlert(null), [])
  // Q reopens the problem popup, L opens the log.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target as HTMLElement).closest?.('input, textarea, select'))
        return
      const k = e.key.toLowerCase()
      if (k === 'q' && (useStore.getState().mission.run?.pendingEvents.length ?? 0) > 0)
        reopenProblem()
      else if (k === 'l') useProblems.setState((s) => ({ logOpen: !s.logOpen }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // NOVA: one tip the first time a hands-on task is waiting.
  const hintsOn = useHints()
  const diyTipShown = useNova((s) => s.diyTipShown)
  const diyTip = activeTask !== null && !diyTipShown && !taskOpen && hintsOn
  const crew = useMemo<NpcSpec[]>(
    () =>
      p.team.map((c) => ({
        id: c.id,
        name: c.name,
        color: ROLE_TOKEN[c.role],
        post: ROLE_POST[c.role],
      })),
    [p.team],
  )
  const callbacks = useMemo<HabitatCallbacks>(
    () => ({
      onTarget: setTarget,
      onInteract: (t) => {
        // A hands-on task waiting at this station: E opens it instead of the station info.
        const task = useCrewTask.getState().active
        if (task && t.kind === 'station' && t.key === task.task.station) {
          useCrewTask.getState().set({ open: true })
          return
        }
        if (t.kind === 'crew') setPopup({ kind: 'crew', id: t.key })
        else setPopup({ kind: 'station', key: t.key })
      },
      isPaused: () => live.current,
      alerts: () => alertsRef.current,
      taskStation: () => useCrewTask.getState().active?.task.station ?? null,
      crewAlerts: () => crewAlertRef.current,
      onPlayerScreen: (x, y) => {
        anchor.current = { x, y }
        if (promptRef.current) promptRef.current.style.transform = promptTransform(x, y)
      },
    }),
    [],
  )

  // Esc closes a popup, otherwise opens the pause menu (events need an answer and stay open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      setPopup((cur) => {
        if (!cur) setMenu((mm) => mm ?? 'pause')
        return null
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Mission over: let the last action finish, fade to the title card, then the debrief.
  const finish = useRef({ design: p.design, content: p.content })
  useEffect(() => {
    finish.current = { design: p.design, content: p.content }
  }, [p.design, p.content])
  const done = m.over && !m.acting && !m.pending && !m.notice
  useEffect(() => {
    if (!done) return
    const a = setTimeout(() => setEnding(true), END_PAUSE_MS)
    // Back to Earth: the run is scored and saved, then the HQ Briefing room opens the debrief.
    const b = setTimeout(() => {
      const r = useStore.getState().mission.run
      if (r && finish.current.design)
        returnToEarth(r, finish.current.design, finish.current.content)
    }, END_PAUSE_MS + END_CARD_MS)
    return () => (clearTimeout(a), clearTimeout(b))
  }, [done])

  const { run, pending } = m
  if (!run || !p.design || !p.destination) {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-bg">
        <p className="font-title text-2xl tracking-wide text-primary uppercase">
          No mission in flight
        </p>
        <button
          type="button"
          className="border border-accent px-4 py-2 font-title tracking-widest text-accent uppercase"
          onClick={() => setPhase('hq')}
        >
          Back to HQ
        </button>
      </main>
    )
  }
  const bars = gauges(run, p.design, p.content, scienceTarget)
  const member = popup?.kind === 'crew' ? p.team.find((c) => c.id === popup.id) : undefined
  const showPrompt = target && !popup && !menu && !pending && !ending
  const action = target?.kind === 'crew' ? `Talk to ${target.label}` : `Use ${target?.label ?? ''}`

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9 }}
      className="fixed inset-0 overflow-hidden blueprint-grid"
      data-testid="habitat-world"
    >
      <HabitatCanvas
        room={room}
        crew={crew}
        callbacks={callbacks}
        onScene={(s) => (sceneRef.current = s)}
      />
      <div className="pointer-events-none absolute inset-0 bg-radial from-transparent from-55% to-bg/85" />
      {showPrompt && (
        <InteractPrompt
          ref={promptRef}
          action={action ?? ''}
          x={anchor.current.x}
          y={anchor.current.y}
        />
      )}
      <HudFrame
        topLeft={
          <>
            <DayBadge info={dayInfo(run, p.destination, p.content)} />
            <TaskList
              active={activeTask}
              stationLabel={
                activeTask
                  ? (stationLabels[activeTask.task.station] ?? activeTask.task.station)
                  : ''
              }
            />
          </>
        }
        topCenter={<ResultToast toast={m.toast} />}
        topRight={<GaugeStrip gauges={bars} />}
        bottomLeft={
          <>
            <MissionLog log={run.eventLog} />
            <p className="mt-1 font-mono text-xs text-subtle">
              WASD move · Shift run · E use · Esc pause · F2 debug
            </p>
          </>
        }
        bottomRight={
          <TurnControls
            canAdvance={!m.over && !m.notice && !m.acting}
            canFastForward={!m.over && !pending && !m.notice && !m.acting}
            fastForward={m.fastForward}
            onNext={() =>
              m.run && m.run.pendingEvents.length > 0 ? setConfirmNext(true) : m.nextTurn()
            }
            onFastForward={m.setFastForward}
          />
        }
      />
      <NovaCompanion
        className="bottom-40 left-4"
        lines={tutorial.lines ?? (diyTip ? [DIY_TIP] : null)}
        onDone={tutorial.lines ? tutorial.onDone : () => useNova.setState({ diyTipShown: true })}
        onSkip={tutorial.active ? skipTutorial : undefined}
      />
      {activeTask && taskOpen && (
        <TaskPanel
          key={activeTask.uid}
          active={activeTask}
          stationLabel={stationLabels[activeTask.task.station] ?? activeTask.task.station}
          onClose={() => useCrewTask.getState().set({ open: false })}
          onFinish={(completed) => {
            const ev = p.content.events.find((e) => e.id === activeTask.eventId)
            useTaskStats.getState().record(runKey(run), completed)
            useCrewTask.getState().set({ active: null, open: false })
            if (ev)
              void m.choose(
                ev,
                activeTask.plan.optionId,
                activeTask.plan.crewId,
                completed ? activeTask.task.successBonus : 0,
                completed ? 'hands-on task done' : 'hands-on task not finished',
              )
          }}
        />
      )}
      <MissionEventLayer
        stationLabels={stationLabels}
        run={run}
        design={p.design}
        content={p.content}
        pending={pending}
        notice={m.notice}
        sting={m.sting}
        acting={m.acting}
        delayMin={dayInfo(run, p.destination, p.content).delayMin}
        onChoose={(e, o, c, b) => void m.choose(e, o, c, b)}
        onApprove={(e, pr) => void m.approve(e, pr)}
        onAckNotice={m.ackNotice}
      />
      {member && (
        <CrewStatusPopup
          member={member}
          run={run}
          content={p.content}
          post={room.workstations.find((w) => w.kind === ROLE_POST[member.role])?.label ?? 'post'}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.kind === 'station' && (
        <StationPopup
          kind={popup.key}
          run={run}
          design={p.design}
          content={p.content}
          team={p.team}
          gauges={bars}
          day={dayInfo(run, p.destination, p.content)}
          alerts={alerts}
          scienceTarget={scienceTarget}
          trades={trades}
          onClose={() => setPopup(null)}
        />
      )}
      {ending && (
        <MissionEndCard
          run={run}
          outcome={computeScore(run, p.design, p.content, { tradesCount: trades }).outcome}
        />
      )}
      <ProblemButtons
        pending={run.pendingEvents.length}
        urgent={run.pendingEvents.some(
          (pe) => p.content.events.find((e) => e.id === pe.eventId)?.urgency === 'urgent',
        )}
        taskLabel={
          activeTask
            ? `${TASK_LABEL[activeTask.task.taskType]}: ${stationLabel(activeTask.task.station)}`
            : null
        }
      />
      {logOpen && (
        <ProblemLogPanel
          entries={problemLog(
            run,
            p.content.events,
            (id) => p.content.crew.find((c) => c.id === id)?.name ?? id,
          )}
          stationLabel={stationLabel}
        />
      )}
      <Modal
        open={confirmNext}
        onClose={() => setConfirmNext(false)}
        title="Unresolved problems"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmNext(false)}>
              Go back
            </Button>
            <Button
              onClick={() => {
                setConfirmNext(false)
                m.handOverAndAdvance()
              }}
              data-testid="confirm-handover"
            >
              Continue
            </Button>
          </>
        }
      >
        <p className="text-primary" data-testid="handover-text">
          {run.pendingEvents.length} problem{run.pendingEvents.length === 1 ? '' : 's'} unresolved.
          The responsible teammate will handle {run.pendingEvents.length === 1 ? 'it' : 'them'} with
          their default choice. Continue?
        </p>
      </Modal>
      <PauseMenu
        state={menu}
        onChange={setMenu}
        onMainMenu={() => (setMenu(null), setPhase('title'))}
      />
    </motion.main>
  )
}
