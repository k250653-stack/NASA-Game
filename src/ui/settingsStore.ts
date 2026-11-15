/**
 * Player settings (sound, music, reduced motion). Saved to localStorage under their own key,
 * separate from the game save.
 * Read with selectors only: useSettings((s) => s.soundOn).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { setMuted, setMusicMuted, setMusicVolume, setSoundVolume } from './sound'

export const SETTINGS_KEY = 'mission-control-settings'

interface SettingsState {
  soundOn: boolean
  musicOn: boolean
  reducedMotion: boolean
  /** NOVA tutorial and lesson pop-ups. null = by difficulty (on for Cadet/Engineer). */
  hints: boolean | null
  /** 0-1 */
  soundVolume: number
  /** 0-1 */
  musicVolume: number
  /** Subtle CRT scanline overlay. */
  crt: boolean
  /** Repair timing mini-game during the mission (off = the plain chance is used). */
  minigames: boolean
  setSoundOn: (on: boolean) => void
  setMusicOn: (on: boolean) => void
  setReducedMotion: (on: boolean) => void
  setHints: (on: boolean | null) => void
  setSoundVolume: (v: number) => void
  setMusicVolume: (v: number) => void
  setCrt: (on: boolean) => void
  setMinigames: (on: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      soundOn: true,
      musicOn: true,
      reducedMotion: false,
      hints: null,
      soundVolume: 0.8,
      musicVolume: 0.5,
      crt: false,
      minigames: true,
      setSoundOn: (soundOn) => set({ soundOn }),
      setMusicOn: (musicOn) => set({ musicOn }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setHints: (hints) => set({ hints }),
      setSoundVolume: (soundVolume) => set({ soundVolume }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      setCrt: (crt) => set({ crt }),
      setMinigames: (minigames) => set({ minigames }),
    }),
    {
      name: SETTINGS_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        soundOn: s.soundOn,
        musicOn: s.musicOn,
        reducedMotion: s.reducedMotion,
        hints: s.hints,
        soundVolume: s.soundVolume,
        musicVolume: s.musicVolume,
        crt: s.crt,
        minigames: s.minigames,
      }),
    },
  ),
)

// Keep the audio layer in sync with the saved toggles (also right after loading them).
function syncAudio(s: SettingsState): void {
  setMuted(!s.soundOn)
  setMusicMuted(!s.musicOn)
  setSoundVolume(s.soundVolume ?? 0.8)
  setMusicVolume(s.musicVolume ?? 0.5)
}
syncAudio(useSettings.getState())
useSettings.subscribe(syncAudio)
