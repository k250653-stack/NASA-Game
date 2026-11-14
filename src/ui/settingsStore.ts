/**
 * Player settings (sound, music, reduced motion) plus the last in-game phase, so the main menu
 * can offer "Continue". Saved to localStorage under its own key, separate from the game save.
 * Read with selectors only: useSettings((s) => s.soundOn).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useStore, type Phase } from '@/store'
import { setMuted, setMusicMuted } from './sound'

export const SETTINGS_KEY = 'mission-control-settings'

interface SettingsState {
  soundOn: boolean
  musicOn: boolean
  reducedMotion: boolean
  /** Last game screen the player was on (never title/codex/styleguide); null = no save. */
  lastPhase: Phase | null
  setSoundOn: (on: boolean) => void
  setMusicOn: (on: boolean) => void
  setReducedMotion: (on: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      soundOn: true,
      musicOn: true,
      reducedMotion: false,
      lastPhase: null,
      setSoundOn: (soundOn) => set({ soundOn }),
      setMusicOn: (musicOn) => set({ musicOn }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: SETTINGS_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        soundOn: s.soundOn,
        musicOn: s.musicOn,
        reducedMotion: s.reducedMotion,
        lastPhase: s.lastPhase,
      }),
    },
  ),
)

// Keep the audio layer in sync with the saved toggles (also right after loading them).
function syncAudio(s: SettingsState): void {
  setMuted(!s.soundOn)
  setMusicMuted(!s.musicOn)
}
syncAudio(useSettings.getState())
useSettings.subscribe(syncAudio)

const NOT_RESUMABLE: Phase[] = ['title', 'codex', 'styleguide']

function trackPhase(phase: Phase): void {
  if (!NOT_RESUMABLE.includes(phase)) useSettings.setState({ lastPhase: phase })
}
trackPhase(useStore.getState().game.phase)
useStore.subscribe((s) => trackPhase(s.game.phase))

/** The phase "Continue" resumes, or null when there is no game in progress. */
export function resumePhase(): Phase | null {
  const { lastPhase } = useSettings.getState()
  return lastPhase && useStore.getState().game.destinationId ? lastPhase : null
}
