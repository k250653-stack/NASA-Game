import { useSettings } from '@/ui/settingsStore'
import { SOUND_IDS } from '@/ui/sfx'
import { playSound } from '@/ui/sound'

function Slider({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-4 py-3">
      <span className="w-32 text-primary">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="flex-1 accent-alert"
        data-testid={`setting-${id}`}
      />
      <span className="w-10 text-right font-mono text-sm text-muted tabular-nums">
        {Math.round(value * 100)}
      </span>
    </label>
  )
}

/** Sound and music volume. */
export function VolumeSliders() {
  const masterVolume = useSettings((s) => s.masterVolume)
  const setMasterVolume = useSettings((s) => s.setMasterVolume)
  const soundVolume = useSettings((s) => s.soundVolume)
  const musicVolume = useSettings((s) => s.musicVolume)
  const setSoundVolume = useSettings((s) => s.setSoundVolume)
  const setMusicVolume = useSettings((s) => s.setMusicVolume)
  return (
    <>
      <Slider
        id="master-volume"
        label="Master volume"
        value={masterVolume}
        onChange={setMasterVolume}
      />
      <Slider
        id="sound-volume"
        label="Sound volume"
        value={soundVolume}
        onChange={setSoundVolume}
      />
      <Slider
        id="music-volume"
        label="Music volume"
        value={musicVolume}
        onChange={setMusicVolume}
      />
    </>
  )
}

/** Subtle CRT scanlines over the whole game (off by default). */
export function CrtToggle() {
  const crt = useSettings((s) => s.crt)
  const setCrt = useSettings((s) => s.setCrt)
  return (
    <label className="flex items-center justify-between gap-6 py-3">
      <span>
        <span className="block text-primary">CRT scanlines</span>
        <span className="block text-sm text-muted">A faint retro screen effect.</span>
      </span>
      <input
        type="checkbox"
        checked={crt}
        onChange={(e) => setCrt(e.target.checked)}
        className="size-5 accent-alert"
        data-testid="setting-crt"
      />
    </label>
  )
}

/** Repair timing mini-game during the mission (on by default). */
export function MinigameToggle() {
  const on = useSettings((s) => s.minigames)
  const set = useSettings((s) => s.setMinigames)
  return (
    <label className="flex items-center justify-between gap-6 py-3">
      <span>
        <span className="block text-primary">Repair mini-game</span>
        <span className="block text-sm text-muted">
          Timing bar on repairs: a hit adds to the success chance.
        </span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => set(e.target.checked)}
        className="size-5 accent-alert"
        data-testid="setting-minigames"
      />
    </label>
  )
}

/** NOVA tips: Lots / Some / Off (default Lots). */
export function NovaTipsSetting() {
  const mode = useSettings((s) => s.novaTips)
  const set = useSettings((s) => s.setNovaTips)
  return (
    <div className="flex items-center justify-between gap-6 py-3" data-testid="setting-nova-tips">
      <span>
        <span className="block text-primary">NOVA tips</span>
        <span className="block text-sm text-muted">
          Short hints as things happen. At most one a minute.
        </span>
      </span>
      <span className="flex gap-1" role="radiogroup" aria-label="NOVA tips">
        {(['lots', 'some', 'off'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => set(m)}
            className={`label-caps border-2 px-2 py-0.5 text-sm ${mode === m ? 'border-accent text-accent' : 'border-border text-muted hover:text-primary'}`}
          >
            {m}
          </button>
        ))}
      </span>
    </div>
  )
}

/** Dev builds only: one button per sound effect, to hear and judge them. */
export function SoundTest() {
  if (!import.meta.env.DEV) return null
  return (
    <div className="py-3" data-testid="sound-test">
      <p className="label-caps text-sm text-muted">Sound test (dev only)</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SOUND_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => playSound(id)}
            className="border-2 border-border-strong px-2 py-0.5 font-mono text-xs text-primary hover:border-accent hover:text-accent"
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  )
}
