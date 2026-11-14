import { Icon } from './Icon'
import { Tooltip } from './Tooltip'
import { useUi } from './uiStore'

export function SoundToggle() {
  const soundOn = useUi((s) => s.soundOn)
  const setSoundOn = useUi((s) => s.setSoundOn)
  return (
    <Tooltip content={soundOn ? 'Mute sound' : 'Unmute sound'} side="bottom">
      <button
        type="button"
        onClick={() => setSoundOn(!soundOn)}
        aria-pressed={!soundOn}
        aria-label="Mute sound"
        className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-panel-raised hover:text-primary"
      >
        <Icon name={soundOn ? 'IconVolume' : 'IconVolumeOff'} size={20} />
      </button>
    </Tooltip>
  )
}
