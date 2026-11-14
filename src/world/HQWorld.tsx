import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '@/store'
import { getHqMap } from './hqMap'
import type { SceneCallbacks, Target } from './HQScene'
import { InteractPrompt, promptTransform } from './InteractPrompt'
import { PauseMenu, type PauseState } from './PauseMenu'
import { PopupPanel } from './PopupPanel'
import { doorLockReason } from './steps'
import { WorldCanvas } from './WorldCanvas'
import { closePopup, openStep, savePlayerPos, useWorld } from './worldStore'

function interact(target: Target): void {
  if (target.kind === 'station') openStep(target.opens)
}

/** Lock reason per gated room id; recomputed when the progress it depends on changes. */
function useRoomLocks(): Record<string, string | null> {
  const planningDone = useWorld((s) => s.planningDone)
  const scenarioId = useStore((s) => s.game.scenarioId)
  const roleChoice = useStore((s) => s.game.roleChoice)
  const difficulty = useStore((s) => s.game.difficulty)
  const recruitedIds = useStore((s) => s.crew.recruitedIds)
  const launched = useStore((s) => s.mission.run !== null)
  return useMemo(() => {
    void [scenarioId, roleChoice, difficulty, recruitedIds, launched] // inputs of doorLockReason
    const locks: Record<string, string | null> = {}
    for (const c of getHqMap().corridors) locks[c.roomId] = doorLockReason(c.door, planningDone)
    return locks
  }, [planningDone, scenarioId, roleChoice, difficulty, recruitedIds, launched])
}

/**
 * The walkable HQ (phase "hq", or a station popup open). Phaser draws the connected rooms; the
 * backdrop, prompt, popup and pause menu are React.
 */
export default function HQWorld({ popup }: { popup?: ReactNode }) {
  const popupStep = useWorld((s) => s.popup)
  const setPhase = useStore((s) => s.setPhase)
  const [spawn] = useState(() => useWorld.getState().playerPos)
  const locks = useRoomLocks()
  const [target, setTarget] = useState<Target | null>(null)
  const [menu, setMenu] = useState<PauseState>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const anchor = useRef({ x: 0, y: 0 })
  const live = useRef({ paused: false, locks })
  useEffect(() => {
    live.current = { paused: popupStep !== null || menu !== null, locks }
  }, [popupStep, menu, locks])

  const callbacks = useMemo<SceneCallbacks>(
    () => ({
      onTarget: setTarget,
      onInteract: interact,
      onPlayerMoved: savePlayerPos,
      isPaused: () => live.current.paused,
      locks: () => live.current.locks,
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
      if (useWorld.getState().popup) closePopup()
      else setMenu((m) => m ?? 'pause')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showPrompt = target && !popupStep && !menu

  return (
    <main className="fixed inset-0 overflow-hidden blueprint-grid" data-testid="hq-world">
      <WorldCanvas spawn={spawn} callbacks={callbacks} />
      <div className="pointer-events-none absolute inset-0 bg-radial from-transparent from-55% to-bg/85" />
      {showPrompt && (
        <InteractPrompt
          ref={promptRef}
          action={`Use ${target.label}`}
          lockedLabel={target.label}
          lockReason={target.kind === 'locked' ? (locks[target.roomId] ?? null) : null}
          x={anchor.current.x}
          y={anchor.current.y}
        />
      )}
      <p className="pointer-events-none absolute bottom-4 left-4 font-mono text-xs text-subtle">
        WASD / arrows move · Shift run · E use · Esc pause · F2 debug
      </p>
      {popupStep && popup && <PopupPanel onClose={closePopup}>{popup}</PopupPanel>}
      <PauseMenu
        state={menu}
        onChange={setMenu}
        onMainMenu={() => {
          setMenu(null)
          setPhase('title')
        }}
      />
    </main>
  )
}
