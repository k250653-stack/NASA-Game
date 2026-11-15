import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { usePlanning } from '@/screens/planning/usePlanning'
import { useStore } from '@/store'
import { NovaCompanion } from '@/nova/NovaCompanion'
import { skipTutorial, useNova } from '@/nova/novaStore'
import { useHabitatTutorial } from '@/nova/tutorial'
import { emitConcept } from '@/store/concepts'
import { computeScore } from '@/engine/score'
import { returnToEarth } from './debrief/debrief'
import { HabitatCanvas } from './HabitatCanvas'
import type { HabitatCallbacks, HabitatScene, HabitatTarget, NpcSpec } from './HabitatScene'
import { InteractPrompt, promptTransform } from './InteractPrompt'
import { EventPopup } from './mission/EventPopup'
import { MissionEndCard } from './mission/MissionEndCard'
import { DayBadge, GaugeStrip, MissionLog, ResultToast, TurnControls } from './mission/MissionHud'
import { dayInfo, gauges, ROLE_POST, ROLE_TOKEN } from './mission/missionRun'
import { StationPopup } from './mission/StationPopup'
import { attention } from './mission/stationStatus'
import { CrewStatusPopup } from './mission/StatusPopups'
import { useMissionRun } from './mission/useMissionRun'
import { PauseMenu, type PauseState } from './PauseMenu'
import { getRoom, type WorkstationKind } from './rooms/room'

/** After the mission ends: a beat in the room, then the title card, then the debrief. */
const END_PAUSE_MS = 1200
const END_CARD_MS = 2800

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
  const paused = popup !== null || menu !== null || m.pending !== null || ending || novaOpen
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
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])

  const room = getRoom(p.destination?.id === 'mars' ? 'mars-habitat' : 'moon-habitat')
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
        if (t.kind === 'crew') setPopup({ kind: 'crew', id: t.key })
        else setPopup({ kind: 'station', key: t.key })
      },
      isPaused: () => live.current,
      alerts: () => alertsRef.current,
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
  const done = m.over && !m.acting && !m.pending
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
      <DayBadge info={dayInfo(run, p.destination, p.content)} />
      <GaugeStrip gauges={bars} />
      <MissionLog log={run.eventLog} />
      <NovaCompanion
        className="bottom-36 left-4"
        lines={tutorial.lines}
        onDone={tutorial.onDone}
        onSkip={tutorial.active ? skipTutorial : undefined}
      />
      <p className="pointer-events-none absolute bottom-4 left-4 font-mono text-xs text-subtle">
        WASD move · Shift run · E use · Esc pause · F2 debug
      </p>
      <TurnControls
        canAdvance={!m.over && !pending && !m.acting}
        fastForward={m.fastForward}
        onNext={m.nextTurn}
        onFastForward={m.setFastForward}
      />
      <ResultToast toast={m.toast} />
      {pending && !m.acting && (
        <EventPopup
          key={pending.id + run.turnIndex}
          event={pending}
          run={run}
          design={p.design}
          content={p.content}
          onChoose={(o, c) => void m.choose(pending, o, c)}
        />
      )}
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
      <PauseMenu
        state={menu}
        onChange={setMenu}
        onMainMenu={() => (setMenu(null), setPhase('title'))}
      />
    </motion.main>
  )
}
