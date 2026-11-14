import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { Point } from './geometry'
import { RoomScene, type RoomSceneData, type SceneCallbacks } from './RoomScene'
import type { Room } from './rooms/room'

interface WorldCanvasProps {
  room: Room
  spawn: Point
  callbacks: SceneCallbacks
}

/**
 * Mounts one Phaser game (transparent, so the CSS backdrop shows around the room) and destroys
 * it on unmount. A new room or spawn restarts the scene; callbacks are always the latest.
 */
export function WorldCanvas({ room, spawn, callbacks }: WorldCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])
  const data = useRef<RoomSceneData>({ room, spawn })

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      pixelArt: true,
      roundPixels: true,
      transparent: true,
      banner: false,
      scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    })
    game.scene.add('room', new RoomScene(() => callbacksRef.current), true, data.current)
    gameRef.current = game
    return () => {
      gameRef.current = null
      game.destroy(true)
    }
  }, [])

  useEffect(() => {
    if (data.current.room === room && data.current.spawn === spawn) return
    data.current = { room, spawn }
    gameRef.current?.scene.getScene('room')?.scene.restart(data.current)
  }, [room, spawn])

  return <div ref={parentRef} className="absolute inset-0" data-testid="world-canvas" />
}
