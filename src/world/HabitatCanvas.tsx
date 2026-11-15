import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { HabitatScene, type HabitatCallbacks, type NpcSpec } from './HabitatScene'
import type { Room } from './rooms/room'

interface HabitatCanvasProps {
  room: Room
  crew: NpcSpec[]
  callbacks: HabitatCallbacks
  /** Receives the scene once it exists, so React can make the crew act. */
  onScene: (scene: HabitatScene | null) => void
}

/** Mounts one Phaser game with the habitat (read once at mount) and destroys it on unmount. */
export function HabitatCanvas({ room, crew, callbacks, onScene }: HabitatCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])
  const initial = useRef({ room, crew, onScene })

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
    const { room: r, crew: c, onScene: ready } = initial.current
    const scene = new HabitatScene(r, c, () => callbacksRef.current)
    game.scene.add('habitat', scene, true)
    ready(scene)
    return () => {
      ready(null)
      game.destroy(true)
    }
  }, [])

  return <div ref={parentRef} className="absolute inset-0" data-testid="habitat-canvas" />
}
