/**
 * Player settings (sound, music, reduced motion). Saved to localStorage under their own key,
 * separate from the game save.
 * Read with selectors only: useSettings((s) => s.soundOn).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { setMuted, setMusicMuted } from './sound'

export const SETTINGS_KEY = 'mission-control-settings'

interface SettingsState {
  soundOn: boolean
  musicOn: boolean
  reducedMotion: boolean
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
