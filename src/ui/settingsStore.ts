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
  /** NOVA tutorial and lesson pop-ups. null = by difficulty (on for Cadet/Engineer). */
  hints: boolean | null
  setSoundOn: (on: boolean) => void
  setMusicOn: (on: boolean) => void
  setReducedMotion: (on: boolean) => void
  setHints: (on: boolean | null) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      soundOn: true,
      musicOn: true,
      reducedMotion: false,
      hints: null,
      setSoundOn: (soundOn) => set({ soundOn }),
      setMusicOn: (musicOn) => set({ musicOn }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setHints: (hints) => set({ hints }),
    }),
    {
      name: SETTINGS_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        soundOn: s.soundOn,
        musicOn: s.musicOn,
        reducedMotion: s.reducedMotion,
        hints: s.hints,
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
