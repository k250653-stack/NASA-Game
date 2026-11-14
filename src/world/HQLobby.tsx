import { useMemo, useRef, useState } from 'react'
import { useStore } from '@/store'
import { doorLockReason } from './doors'
import { centroid, nearestStandable, type Point, type Polygon } from './geometry'
import type { SceneCallbacks } from './LobbyScene'
import { getHqLobby, type Door, type Room } from './rooms/room'
import { WorldCanvas } from './WorldCanvas'
import { enterDoor, useWorld } from './worldStore'

/** Centre of the floor, or just in front of the door the player came out of. */
function spawnPoint(room: Room, doorId: string | null): Point {
  const floor = centroid(room.walkable as Polygon)
  const door = room.doors.find((d) => d.id === doorId)
  if (!door) return floor
  return nearestStandable(centroid(door.area as Polygon), floor, room.walkable as Polygon, room.blocked as Polygon[])
}

/** The walkable HQ lobby (phase "hq"). Phaser draws the room; prompts are React on top. */
export default function HQLobby() {
  const room = getHqLobby()
  const spawnDoorId = useWorld((s) => s.spawnDoorId)
  const setPhase = useStore((s) => s.setPhase)
  // Only the spawn at mount matters; the scene owns the position after that.
  const [spawn] = useState(() => spawnPoint(room, spawnDoorId))
  const [near, setNear] = useState<Door | null>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const anchor = useRef({ x: 0, y: 0 })

  const callbacks = useMemo<SceneCallbacks>(
    () => ({
      onNearDoor: setNear,
      onInteract: (door) => {
        if (!doorLockReason(door)) enterDoor(door.id, door.target)
      },
      onPlayerScreen: (x, y) => {
        anchor.current = { x, y }
        if (promptRef.current) promptRef.current.style.transform = promptTransform(x, y)
      },
    }),
    [],
  )
  const lockReason = near ? doorLockReason(near) : null

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg" data-testid="hq-lobby">
      <WorldCanvas room={room} spawn={spawn} callbacks={callbacks} />
      {near && (
        <div
          ref={promptRef}
          data-testid="door-prompt"
          className={`pointer-events-none absolute top-0 left-0 border bg-bg/90 px-2 py-1 font-mono text-xs whitespace-nowrap uppercase ${lockReason ? 'border-danger/70 text-danger' : 'border-border-strong text-primary'}`}
          style={{ transform: promptTransform(anchor.current.x, anchor.current.y) }}
        >
          {lockReason ? (
            <>
              <span className="block">Locked · {near.label}</span>
              <span className="block normal-case text-danger/80">{lockReason}</span>
            </>
          ) : (
            <>E · Enter {near.label}</>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setPhase('title')}
        className="absolute top-4 left-4 font-title text-sm tracking-[0.3em] text-muted uppercase hover:text-primary"
      >
        ← Menu
      </button>
      <p className="pointer-events-none absolute bottom-4 left-4 font-mono text-xs text-subtle">
        WASD / arrows move · Shift run · E enter
      </p>
    </main>
  )
}

/** Centred above the anchor with a small gap. */
function promptTransform(x: number, y: number): string {
  return `translate(${Math.round(x)}px, ${Math.round(y) - 8}px) translate(-50%, -100%)`
}
