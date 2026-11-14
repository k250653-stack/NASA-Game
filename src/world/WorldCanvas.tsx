import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { Point } from './geometry'
import { HQScene, type SceneCallbacks } from './HQScene'

interface WorldCanvasProps {
  /** Where the player starts (read once at mount). */
  spawn: Point | null
  callbacks: SceneCallbacks
}

/**
 * Mounts one Phaser game with the whole HQ (transparent, so the CSS backdrop shows behind it)
 * and destroys it on unmount. Callbacks are always the latest ones passed in.
 */
export function WorldCanvas({ spawn, callbacks }: WorldCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])
  const initialSpawn = useRef(spawn)

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
    game.scene.add('hq', new HQScene(() => callbacksRef.current, initialSpawn.current), true)
    return () => game.destroy(true)
  }, [])

  return <div ref={parentRef} className="absolute inset-0" data-testid="world-canvas" />
}
