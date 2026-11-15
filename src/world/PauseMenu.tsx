import { SettingsModal } from '@/screens/menu/SettingsModal'
import { Button } from '@/ui/Button'
import { AstronautPicker } from '@/screens/menu/AstronautPicker'
import { useStore } from '@/store'
import { Modal } from '@/ui/Modal'
import { openCodex, replayTutorial } from '@/nova/novaStore'

export type PauseState = 'pause' | 'settings' | 'astronaut' | null

interface PauseMenuProps {
  state: PauseState
  onChange: (state: PauseState) => void
  onMainMenu: () => void
}

/** Esc in a room: Resume, Settings, Main menu. Closing Settings returns here. */
export function PauseMenu({ state, onChange, onMainMenu }: PauseMenuProps) {
  const appearance = useStore((s) => s.game.playerAppearance)
  const setAppearance = useStore((s) => s.setPlayerAppearance)
  return (
    <>
      <Modal open={state === 'pause'} onClose={() => onChange(null)} title="Paused" size="sm">
        <div className="flex flex-col gap-2" data-testid="pause-menu">
          <Button onClick={() => onChange(null)}>Resume</Button>
          <Button variant="secondary" onClick={() => onChange('settings')}>
            Settings
          </Button>
          <Button
            variant="secondary"
            onClick={() => onChange('astronaut')}
            data-testid="pause-change-astronaut"
          >
            Change astronaut
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onChange(null)
              openCodex()
            }}
            data-testid="pause-nova-notes"
          >
            NOVA&apos;s notes
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onChange(null)
              replayTutorial()
            }}
            data-testid="pause-replay-tutorial"
          >
            Replay tutorial
          </Button>
          <Button variant="secondary" onClick={onMainMenu}>
            Main menu
          </Button>
        </div>
      </Modal>
      <SettingsModal open={state === 'settings'} onClose={() => onChange('pause')} />
      <Modal
        open={state === 'astronaut'}
        onClose={() => onChange('pause')}
        title="Change astronaut"
        size="md"
      >
        <AstronautPicker
          value={appearance}
          scale={2}
          onChoose={(id) => {
            setAppearance(id)
            onChange(null)
          }}
        />
      </Modal>
    </>
  )
}
