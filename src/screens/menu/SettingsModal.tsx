import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { useSettings } from '@/ui/settingsStore'
import { CrtToggle, SoundTest, VolumeSliders } from './AudioSettings'
import { hintsOn } from '@/nova/novaStore'
import { useStore } from '@/store'

interface ToggleRowProps {
  id: string
  label: string
  description: string
  on: boolean
  onChange: (on: boolean) => void
}

function ToggleRow({ id, label, description, on, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <p className="text-primary">{label}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        data-testid={`setting-${id}`}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? 'border-accent bg-accent/30' : 'border-border-strong bg-surface'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full transition-transform ${on ? 'translate-x-5 bg-accent' : 'bg-muted'}`}
        />
      </button>
    </div>
  )
}

/** Sound, music and reduced motion. Saved straight away (settingsStore persists them). */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const soundOn = useSettings((s) => s.soundOn)
  const musicOn = useSettings((s) => s.musicOn)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const setSoundOn = useSettings((s) => s.setSoundOn)
  const setMusicOn = useSettings((s) => s.setMusicOn)
  const setReducedMotion = useSettings((s) => s.setReducedMotion)
  const hints = useSettings((s) => s.hints)
  const setHints = useSettings((s) => s.setHints)
  const difficulty = useStore((s) => s.game.difficulty)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      size="sm"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="divide-y divide-border">
        <ToggleRow
          id="sound"
          label="Sound effects"
          description="Clicks, alarms and launch sounds."
          on={soundOn}
          onChange={setSoundOn}
        />
        <ToggleRow
          id="music"
          label="Music"
          description="Background music tracks."
          on={musicOn}
          onChange={setMusicOn}
        />
        <ToggleRow
          id="reduced-motion"
          label="Reduced motion"
          description="Turns off sliding and zooming animations."
          on={reducedMotion}
          onChange={setReducedMotion}
        />
        <ToggleRow
          id="hints"
          label="NOVA hints"
          description="Tutorial and lesson pop-ups. On by default for Cadet and Engineer."
          on={hintsOn(hints, difficulty)}
          onChange={setHints}
        />
        <VolumeSliders />
        <CrtToggle />
        <SoundTest />
      </div>
    </Modal>
  )
}
