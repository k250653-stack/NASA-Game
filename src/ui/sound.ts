/**
 * Sound and music. An mp3 in public/assets/sounds|music/ wins when it exists; otherwise sound
 * effects are generated with ZzFX (sfx.ts) and music is a quiet generated drone (drone.ts).
 * Missing files fail silently: existence is checked once per file, nothing is logged.
 * Music waits for the first click or key press (browser autoplay rules) and crossfades.
 */
import { Howl } from 'howler'
import { getAsset, type AudioAssetKind } from './assets'
import { startDrone, startPad, type Drone } from './drone'
import { isSoundId, loadAudio, playSfx } from './sfx'

/** Crossfade between music tracks, seconds. */
const FADE_S = 1.5

let muted = false
let musicMuted = false
let soundVolume = 0.8
let musicVolume = 0.5
/** Music level multiplier: lowered while the alert layer plays (duckMusic). */
let duck = 1
const DUCK_LEVEL = 0.35

/** The alert layer is on: music drops to DUCK_LEVEL, then comes back. */
export function duckMusic(on: boolean): void {
  duck = on ? DUCK_LEVEL : 1
  playing?.setVolume(musicVolume * duck)
}
let unlocked = false

// ---- files ---------------------------------------------------------------------------------

const exists = new Map<string, boolean | Promise<boolean>>()

/** True if the audio file is really there (dev servers answer missing files with index.html). */
function probe(kind: AudioAssetKind, id: string): Promise<boolean> {
  const src = getAsset(kind, id)
  const known = exists.get(src)
  if (known !== undefined) return Promise.resolve(known)
  const p = fetch(src, { method: 'HEAD' })
    .then((r) => r.ok && /audio|mpeg|octet/.test(r.headers.get('content-type') ?? ''))
    .catch(() => false)
    .then((ok) => (exists.set(src, ok), ok))
  exists.set(src, p)
  return p
}

const howls = new Map<string, Howl>()
function howl(kind: AudioAssetKind, id: string): Howl {
  const src = getAsset(kind, id)
  let h = howls.get(src)
  if (!h) {
    h = new Howl({ src: [src], loop: kind === 'music', volume: 0 })
    howls.set(src, h)
  }
  return h
}

// ---- sound effects ---------------------------------------------------------------------------

/** One-shot sound: the mp3 if present, else the generated version. Never throws or logs. */
export function playSound(id: string): void {
  if (muted || soundVolume <= 0) return
  const src = getAsset('sounds', id)
  const known = exists.get(src)
  if (known === true) {
    const h = howl('sounds', id)
    h.volume(soundVolume)
    h.play()
    return
  }
  if (known === undefined) void probe('sounds', id)
  if (isSoundId(id)) playSfx(id, soundVolume)
}

// ---- music -------------------------------------------------------------------------------------

type Playing = { track: string; stop: (fade: number) => void; setVolume: (v: number) => void }
let wanted: string | null = null
let tension = false
let playing: Playing | null = null
let token = 0

function target(): string | null {
  if (musicMuted || !unlocked || musicVolume <= 0 || !wanted) return null
  return tension ? 'tension' : wanted
}

async function applyMusic(): Promise<void> {
  const next = target()
  if (next === (playing?.track ?? null)) return
  const my = ++token
  playing?.stop(FADE_S)
  playing = null
  if (!next) return
  const hasFile = await probe('music', next)
  if (my !== token) return
  if (hasFile) {
    const h = howl('music', next)
    h.volume(0)
    h.play()
    h.fade(0, musicVolume, FADE_S * 1000)
    playing = {
      track: next,
      stop: (fade) => {
        h.fade(h.volume(), 0, fade * 1000)
        setTimeout(() => h.stop(), fade * 1000)
      },
      setVolume: (v) => h.volume(v),
    }
  } else {
    const zz = await loadAudio()
    if (my !== token || !zz) return
    try {
      // HQ and habitat get the calm pad; other scenes the drone.
      const drone: Drone =
        next === 'hq' || next === 'mission'
          ? startPad(zz.audioContext, musicVolume * duck, FADE_S)
          : startDrone(zz.audioContext, next, musicVolume * duck, FADE_S)
      playing = { track: next, ...drone }
    } catch {
      playing = null
    }
  }
}

/** The scene's music: "menu", "hq", "mission", "debrief", or null for silence. */
export function setMusicTrack(track: string | null): void {
  wanted = track
  void applyMusic()
}

/** While an urgent event is open the tension track replaces the scene music, then fades back. */
export function setTension(on: boolean): void {
  tension = on
  void applyMusic()
}

/** Kept for older callers: start a track by id. */
export function playMusic(id: string): void {
  setMusicTrack(id)
}

export function stopMusic(id: string): void {
  if (wanted === id) setMusicTrack(null)
}

// ---- settings ------------------------------------------------------------------------------------

export function stopAllSounds(): void {
  howls.forEach((h) => h.stop())
}

export function setMuted(value: boolean): void {
  muted = value
  if (muted) howls.forEach((h, src) => src.includes('/sounds/') && h.stop())
}

/** Music has its own toggle (Settings); sound effects use setMuted. */
export function setMusicMuted(value: boolean): void {
  musicMuted = value
  void applyMusic()
}

export function setSoundVolume(value: number): void {
  soundVolume = Math.max(0, Math.min(1, value))
}

export function setMusicVolume(value: number): void {
  musicVolume = Math.max(0, Math.min(1, value))
  playing?.setVolume(musicVolume * duck)
  void applyMusic()
}

export function isMuted(): boolean {
  return muted
}

// Browsers only allow audio after a user gesture: resume and start music on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlocked = true
    void loadAudio().then((zz) => zz?.audioContext.resume().catch(() => {}))
    void applyMusic()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}
