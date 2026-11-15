import { useEffect, useRef, type KeyboardEvent } from 'react'
import { PlayerIdle } from '@/ui/PlayerIdle'
import { playSound } from '@/ui/sound'
import {
  APPEARANCE_INFO,
  PLAYER_APPEARANCES,
  type PlayerAppearance,
} from '@/world/player/playerPack'

interface AstronautPickerProps {
  value: PlayerAppearance
  onChoose: (appearance: PlayerAppearance) => void
  /** Whole-number zoom of the idle sprite. */
  scale?: number
}

/**
 * The two astronauts side by side, each with its animated idle sprite. Hover or arrow keys
 * highlight (focus); click or Enter chooses. Used on the choice screen and in the pause menu.
 */
export function AstronautPicker({ value, onChoose, scale = 3 }: AstronautPickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const initial = useRef(value)

  // Start on the current choice so Enter keeps it.
  useEffect(() => {
    const list = ref.current?.querySelectorAll<HTMLButtonElement>('button')
    list?.[PLAYER_APPEARANCES.indexOf(initial.current)]?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const list = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    const step = e.key === 'ArrowRight' ? 1 : -1
    list[(i + step + list.length) % list.length]?.focus()
    playSound('hover')
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Choose your astronaut"
      onKeyDown={onKeyDown}
      className="flex flex-wrap justify-center gap-6"
    >
      {PLAYER_APPEARANCES.map((id) => {
        const info = APPEARANCE_INFO[id]
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === value}
            data-testid={`astronaut-${id}`}
            onMouseEnter={(e) => e.currentTarget.focus()}
            onClick={() => {
              playSound('click')
              onChoose(id)
            }}
            className="group flex flex-col items-center gap-3 border-2 border-border bg-bg/70 px-8 py-5 transition-colors outline-none focus:border-accent focus:bg-accent/10"
          >
            <PlayerIdle appearance={id} scale={scale} />
            <span className="label-caps text-lg text-muted group-focus:text-primary">
              {info.label}
            </span>
            <span className="font-mono text-xs text-subtle">{info.heightCm} cm</span>
          </button>
        )
      })}
    </div>
  )
}
