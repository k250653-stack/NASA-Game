import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { getContent } from '@/content/load'
import { isMissionOver } from '@/engine/mission'
import { useStore } from '@/store'
import { clearDebriefCue, crewAtTable, hasDebriefCue } from './debrief/debrief'
import { DebriefPopup } from './debrief/DebriefPopup'
import { gatedRooms, getHqMap } from './hqMap'
import type { SceneCallbacks, Target } from './HQScene'
import { InteractPrompt, promptTransform } from './InteractPrompt'
import { PauseMenu, type PauseState } from './PauseMenu'
import { PopupPanel } from './PopupPanel'
import { NovaCompanion } from '@/nova/NovaCompanion'
import { skipTutorial, useNova } from '@/nova/novaStore'
import { useHqTutorial } from '@/nova/tutorial'
import type { Step } from './rooms/room'
import { HqInfoModal } from './HqInfoModal'
import { gateLockReason } from './steps'
import { WorldCanvas } from './WorldCanvas'
import { closePopup, openStep, savePlayerPos, useWorld } from './worldStore'

/** A finished mission waits at the Briefing meeting table until the player redesigns. */
function debriefReady(): boolean {
  const run = useStore.getState().mission.run
  return run !== null && isMissionOver(run)
}

/** A station was used: open its step's popup, the debrief, or the lobby's HQ info. */
function interact(target: Target, openInfo: () => void): void {
  if (target.kind !== 'station') return
  if (target.opens === 'info') openInfo()
  else if (target.opens === 'briefing' && debriefReady()) useStore.getState().setPhase('review')
  else openStep(target.opens)
}

/** Popup title-bar section for each station step. */
const STEP_SECTION: Record<Step, string> = {
  planning: 'Mission Planning',
  personnel: 'Personnel',
  briefing: 'Briefing',
  launch: 'Launch Control',
}

/** Opens the debrief this long after returning to Earth. */
const DEBRIEF_DELAY_MS = 1000

/** Lock reason per gated room id; recomputed when the progress it depends on changes. */
function useRoomLocks(): Record<string, string | null> {
  const planningDone = useWorld((s) => s.planningDone)
  const scenarioId = useStore((s) => s.game.scenarioId)
  const roleChoice = useStore((s) => s.game.roleChoice)
  const difficulty = useStore((s) => s.game.difficulty)
  const recruitedIds = useStore((s) => s.crew.recruitedIds)
  const launched = useStore((s) => s.mission.run !== null)
  return useMemo(() => {
    void [scenarioId, roleChoice, difficulty, recruitedIds, launched] // inputs of gateLockReason
    const locks: Record<string, string | null> = {}
    for (const g of gatedRooms(getHqMap())) locks[g.roomId] = gateLockReason(g.gate, planningDone)
    return locks
  }, [planningDone, scenarioId, roleChoice, difficulty, recruitedIds, launched])
}

/**
 * The walkable HQ (phase "hq", or a station popup open). Phaser draws the building; the
 * backdrop, prompt, popup and pause menu are React.
 */
export default function HQWorld({ popup }: { popup?: ReactNode }) {
  const popupStep = useWorld((s) => s.popup)
  const setPhase = useStore((s) => s.setPhase)
  const debriefOpen = useStore((s) => s.game.phase === 'review')
  const debriefAvailable = useStore((s) => s.mission.run !== null && isMissionOver(s.mission.run))
  // The crew wait around the meeting table while a debrief is pending (read once at mount).
  const [crew] = useState(() => {
    const { crew: c } = useStore.getState()
    return debriefReady()
      ? crewAtTable(getContent().crew.filter((m) => c.recruitedIds.includes(m.id)))
      : []
  })
  const [spawn] = useState(() => useWorld.getState().playerPos)
  const locks = useRoomLocks()
  const [target, setTarget] = useState<Target | null>(null)
  const [menu, setMenu] = useState<PauseState>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const promptRef = useRef<HTMLDivElement>(null)
  const anchor = useRef({ x: 0, y: 0 })
  const novaOpen = useNova((s) => s.openLessonId !== null || s.codexOpen)
  const busy = popupStep !== null || menu !== null || debriefOpen || novaOpen || infoOpen
  const tutorial = useHqTutorial(locks, busy)
  const live = useRef({ paused: false, locks, marker: null as string | null })
  useEffect(() => {
    live.current = { paused: busy, locks, marker: tutorial.marker }
  }, [busy, locks, tutorial.marker])

  // Back from a mission: the debrief opens by itself after a moment in the Briefing room.
  useEffect(() => {
    if (!hasDebriefCue()) return
    const t = setTimeout(() => {
      clearDebriefCue()
      setPhase('review')
    }, DEBRIEF_DELAY_MS)
    return () => clearTimeout(t)
  }, [setPhase])

  const callbacks = useMemo<SceneCallbacks>(
    () => ({
      onTarget: setTarget,
      onInteract: (t) => interact(t, () => setInfoOpen(true)),
      onPlayerMoved: savePlayerPos,
      isPaused: () => live.current.paused,
      locks: () => live.current.locks,
      marker: () => live.current.marker,
      onPlayerScreen: (x, y) => {
        anchor.current = { x, y }
        if (promptRef.current) promptRef.current.style.transform = promptTransform(x, y)
      },
    }),
    [],
  )

  // Esc: close the popup, or open the pause menu. In-screen modals handle their own Esc first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (useStore.getState().game.phase === 'review') useStore.getState().setPhase('hq')
      else if (useWorld.getState().popup) closePopup()
      else setMenu((m) => m ?? 'pause')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showPrompt = target && !popupStep && !menu && !debriefOpen && !infoOpen
  const debriefStation =
    target?.kind === 'station' && target.opens === 'briefing' && debriefAvailable

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 overflow-hidden blueprint-grid"
      data-testid="hq-world"
    >
      <WorldCanvas spawn={spawn} callbacks={callbacks} crew={crew} />
      <div className="pointer-events-none absolute inset-0 bg-radial from-transparent from-55% to-bg/85" />
      {showPrompt && (
        <InteractPrompt
          ref={promptRef}
          action={debriefStation ? 'Mission debrief' : `Use ${target.label}`}
          lockedLabel={target.label}
          lockReason={target.kind === 'locked' ? (locks[target.roomId] ?? null) : null}
          x={anchor.current.x}
          y={anchor.current.y}
        />
      )}
      <NovaCompanion
        lines={tutorial.lines}
        onDone={tutorial.onDone}
        onSkip={tutorial.active ? skipTutorial : undefined}
      />
      <p className="pointer-events-none absolute bottom-4 left-4 font-mono text-xs text-subtle">
        WASD / arrows move · Shift run · E use · Esc pause · F2 debug
      </p>
      {popupStep && popup && (
        <PopupPanel onClose={closePopup} section={STEP_SECTION[popupStep]}>
          {popup}
        </PopupPanel>
      )}
      {debriefOpen && <DebriefPopup onClose={() => setPhase('hq')} />}
      <HqInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} locks={locks} />
      <PauseMenu
        state={menu}
        onChange={setMenu}
        onMainMenu={() => {
          setMenu(null)
          setPhase('title')
        }}
      />
    </motion.main>
  )
}
