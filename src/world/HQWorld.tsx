import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '@/store'
import { centroid, nearestStandable, type Point, type Polygon } from './geometry'
import { InteractPrompt, promptTransform } from './InteractPrompt'
import { PauseMenu, type PauseState } from './PauseMenu'
import { PopupPanel } from './PopupPanel'
import type { SceneCallbacks, Target } from './RoomScene'
import { getRoom, type Room } from './rooms/room'
import { doorLockReason } from './steps'
import { WorldCanvas } from './WorldCanvas'
import { closePopup, openStep, roomReady, travel, useWorld } from './worldStore'

/** Centre of the floor, or just in front of the door the player arrives through. */
function spawnPoint(room: Room, doorId: string | null): Point {
  const floor = centroid(room.walkable as Polygon)
  const door = room.doors.find((d) => d.id === doorId)
  if (!door) return floor
  const { walkable, blocked } = room
  return nearestStandable(centroid(door.area as Polygon), floor, walkable as Polygon, blocked as Polygon[])
}

function interact(target: Target): void {
  const { roomId, planningDone } = useWorld.getState()
  const room = getRoom(roomId)
  if (target.kind === 'station') {
    const station = room.stations.find((s) => s.id === target.id)
    if (station) openStep(station.opens)
    return
  }
  const door = room.doors.find((d) => d.id === target.id)
  if (door && !doorLockReason(door, planningDone)) travel(door)
}

/**
 * The walkable HQ (phase "hq", or a station popup open). Phaser draws the room; the backdrop,
 * prompt, popup and pause menu are React.
 */
export default function HQWorld({ popup }: { popup?: ReactNode }) {
  const roomId = useWorld((s) => s.roomId)
  const spawnDoorId = useWorld((s) => s.spawnDoorId)
  const popupStep = useWorld((s) => s.popup)
  const planningDone = useWorld((s) => s.planningDone)
  const setPhase = useStore((s) => s.setPhase)
  const room = getRoom(roomId)
  const spawn = useMemo(() => spawnPoint(room, spawnDoorId), [room, spawnDoorId])
  const [target, setTarget] = useState<Target | null>(null)
  const [menu, setMenu] = useState<PauseState>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const anchor = useRef({ x: 0, y: 0 })
  const paused = useRef(false)
  useEffect(() => {
    paused.current = popupStep !== null || menu !== null
  }, [popupStep, menu])

  const callbacks = useMemo<SceneCallbacks>(
    () => ({
      onTarget: setTarget,
      onInteract: interact,
      onReady: roomReady,
      isPaused: () => paused.current,
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

  const door = target?.kind === 'door' ? room.doors.find((d) => d.id === target.id) : undefined
  const station = target?.kind === 'station' ? room.stations.find((s) => s.id === target.id) : undefined
  const showPrompt = (door || station) && !popupStep && !menu

  return (
    <main className="fixed inset-0 overflow-hidden blueprint-grid" data-testid="hq-world" data-room={room.id}>
      <WorldCanvas room={room} spawn={spawn} callbacks={callbacks} />
      <div className="pointer-events-none absolute inset-0 bg-radial from-transparent from-55% to-bg/85" />
      {showPrompt && (
        <InteractPrompt
          ref={promptRef}
          action={door ? `Enter ${door.label}` : `Use ${station!.label}`}
          lockedLabel={door?.label}
          lockReason={door ? doorLockReason(door, planningDone) : null}
          x={anchor.current.x}
          y={anchor.current.y}
        />
      )}
      <p className="pointer-events-none absolute bottom-4 left-4 font-mono text-xs text-subtle">
        {room.name} · WASD / arrows move · Shift run · E use · Esc pause
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
