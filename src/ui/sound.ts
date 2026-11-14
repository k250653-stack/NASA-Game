/**
 * Thin Howler wrapper. A missing or broken audio file never throws: it warns once per file
 * (console.warn) and plays nothing.
 */
import { Howl } from 'howler'
import { getAsset, type AudioAssetKind } from './assets'

const howls = new Map<string, Howl>()
const warned = new Set<string>()
let muted = false

function warnOnce(src: string, reason: string): void {
  if (warned.has(src)) return
  warned.add(src)
  console.warn(`[sound] could not ${reason} "${src}". Add the file or see public/assets/ASSETS.md.`)
}

function getHowl(kind: AudioAssetKind, id: string): Howl {
  const src = getAsset(kind, id)
  let howl = howls.get(src)
  if (!howl) {
    howl = new Howl({
      src: [src],
      loop: kind === 'music',
      volume: kind === 'music' ? 0.4 : 0.8,
      onloaderror: () => warnOnce(src, 'load'),
      onplayerror: () => warnOnce(src, 'play'),
    })
    howls.set(src, howl)
  }
  return howl
}

/** Plays a one-shot sound effect from public/assets/sounds/<id>.mp3. */
export function playSound(id: string): void {
  if (muted) return
  getHowl('sounds', id).play()
}

/** Starts a looping track from public/assets/music/<id>.mp3 (restarts if already playing). */
export function playMusic(id: string): void {
  if (muted) return
  const howl = getHowl('music', id)
  if (!howl.playing()) howl.play()
}

export function stopMusic(id: string): void {
  howls.get(getAsset('music', id))?.stop()
}

export function stopAllSounds(): void {
  howls.forEach((h) => h.stop())
}

export function setMuted(value: boolean): void {
  muted = value
  if (muted) stopAllSounds()
}

export function isMuted(): boolean {
  return muted
}
