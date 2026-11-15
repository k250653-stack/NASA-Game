import { useEffect, useState } from 'react'
import { useSettings } from '@/ui/settingsStore'
import {
  findSheet,
  loadPlayerManifest,
  PLAYER_DIRECTIONS,
  playerAssetUrl,
  type PlayerAppearance,
  type PlayerDirection,
  type PlayerManifest,
} from '@/world/player/playerPack'

interface PlayerIdleProps {
  appearance: PlayerAppearance
  /** Whole-number zoom of the compact frame (64 x 96). */
  scale?: number
  /** Which way they face (default: towards the viewer). */
  direction?: PlayerDirection
}

/** The animated idle sprite (cabin suit) from the player pack, frame count and fps from the manifest. */
export function PlayerIdle({ appearance, scale = 3, direction = 'S' }: PlayerIdleProps) {
  const [manifest, setManifest] = useState<PlayerManifest | null>(null)
  const [frame, setFrame] = useState(0)
  const reduced = useSettings((s) => s.reducedMotion)

  useEffect(() => {
    let live = true
    loadPlayerManifest().then(
      (m) => live && setManifest(m),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [])

  const sheet = manifest ? findSheet(manifest, appearance, 'cabin', 'idle') : null
  const frameCount = sheet?.frameCount ?? 8
  const fps = sheet?.fps ?? 2
  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => setFrame((f) => (f + 1) % frameCount), 1000 / fps)
    return () => clearInterval(t)
  }, [reduced, frameCount, fps])

  const w = (manifest?.compactFrame.width ?? 64) * scale
  const h = (manifest?.compactFrame.height ?? 96) * scale
  const row = PLAYER_DIRECTIONS.indexOf(direction)
  const col = reduced ? 0 : frame % frameCount
  return (
    <div
      role="img"
      aria-label={appearance === 'player_male' ? 'Male astronaut' : 'Female astronaut'}
      className="shrink-0 [image-rendering:pixelated]"
      style={{
        width: w,
        height: h,
        backgroundImage: sheet ? `url(${playerAssetUrl(sheet.compactPath)})` : undefined,
        backgroundSize: `${frameCount * w}px ${PLAYER_DIRECTIONS.length * h}px`,
        backgroundPosition: `-${col * w}px -${row * h}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  )
}
