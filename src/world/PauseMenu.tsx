import { SettingsModal } from '@/screens/menu/SettingsModal'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

export type PauseState = 'pause' | 'settings' | null

interface PauseMenuProps {
  state: PauseState
  onChange: (state: PauseState) => void
  onMainMenu: () => void
}

/** Esc in a room: Resume, Settings, Main menu. Closing Settings returns here. */
export function PauseMenu({ state, onChange, onMainMenu }: PauseMenuProps) {
  return (
    <>
      <Modal open={state === 'pause'} onClose={() => onChange(null)} title="Paused" size="sm">
        <div className="flex flex-col gap-2" data-testid="pause-menu">
          <Button onClick={() => onChange(null)}>Resume</Button>
          <Button variant="secondary" onClick={() => onChange('settings')}>
            Settings
          </Button>
          <Button variant="secondary" onClick={onMainMenu}>
            Main menu
          </Button>
        </div>
      </Modal>
      <SettingsModal open={state === 'settings'} onClose={() => onChange('pause')} />
    </>
  )
}
