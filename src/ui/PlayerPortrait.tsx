import { useStore } from '@/store'
import { playerAssetUrl, type PlayerAppearance } from '@/world/player/playerPack'

interface PlayerPortraitProps {
  /** Box size in px. */
  size?: number
  /** Show this appearance instead of the saved choice. */
  appearance?: PlayerAppearance
  className?: string
}

/** The player's portrait (the astronaut they chose), drawn with crisp pixels. */
export function PlayerPortrait({ size = 56, appearance, className = '' }: PlayerPortraitProps) {
  const saved = useStore((s) => s.game.playerAppearance)
  const id = appearance ?? saved
  return (
    <img
      src={playerAssetUrl(`portraits/${id}.png`)}
      alt={id === 'player_male' ? 'Male astronaut' : 'Female astronaut'}
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 bg-surface object-cover [image-rendering:pixelated] ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
