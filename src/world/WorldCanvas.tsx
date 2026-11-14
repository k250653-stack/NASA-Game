import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { Point } from './geometry'
import { LobbyScene, type SceneCallbacks } from './LobbyScene'
import type { Room } from './rooms/room'

interface WorldCanvasProps {
  room: Room
  spawn: Point
  callbacks: SceneCallbacks
}

/**
 * Mounts a Phaser game that fills its parent and destroys it on unmount. The room and spawn are
 * read once at mount; callbacks are always the latest ones passed in.
 */
export function WorldCanvas({ room, spawn, callbacks }: WorldCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])
  const initial = useRef({ room, spawn })

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      pixelArt: true,
      roundPixels: true,
      banner: false,
      scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
      scene: new LobbyScene({ ...initial.current, callbacks: () => callbacksRef.current }),
    })
    return () => game.destroy(true)
  }, [])

  return <div ref={parentRef} className="absolute inset-0" data-testid="world-canvas" />
}
