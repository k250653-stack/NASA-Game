/**
 * Retro sound effects generated in code with ZzFX (used when public/assets/sounds/<id>.mp3 is
 * missing). Quiet, soft shapes (sine/triangle), low-pass filtered so nothing is shrill.
 * ZzFX's own pitch randomness uses Math.random, so every sound is built with randomness 0 and
 * pitch variation comes from the seeded generator (CLAUDE.md rule 7).
 *
 * ZzFX parameters, in order: volume, randomness, frequency, attack, sustain, release, shape
 * (0 sine, 1 triangle, 2 saw, 3 tan, 4 noise), shapeCurve, slide, deltaSlide, pitchJump,
 * pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo,
 * filter (positive = low-pass cutoff in Hz).
 */
import type { ZZFX as ZzfxApi } from 'zzfx'
import { createRng } from '@/engine/rng'

export const SOUND_IDS = [
  'click',
  'hover',
  'door',
  'footstep',
  'popup-open',
  'popup-close',
  'alarm',
  'success',
  'fail',
  'launch',
  'countdown-beep',
  'radio',
  'nova-beep',
  'unlock',
  'typewriter',
  'event-sting',
  'minigame-hit',
  'minigame-miss',
  'wire-click',
  'scrub',
  'signal-beep',
  'valve-hiss',
  'alert-beep',
] as const
export type SoundId = (typeof SOUND_IDS)[number]

const SOUNDS: Record<SoundId, number[]> = {
  click: [0.35, 0, 520, 0, 0.012, 0.04, 1, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2400],
  hover: [0.1, 0, 760, 0, 0.006, 0.025, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2000],
  door: [0.3, 0, 180, 0.08, 0.12, 0.32, 4, 1, 3, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.7, 0.05, 0, 900],
  footstep: [0.09, 0, 90, 0, 0.012, 0.045, 4, 1, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 1, 0, 0, 600],
  'popup-open': [
    0.28, 0, 330, 0.01, 0.05, 0.1, 1, 1, 0, 0, 165, 0.05, 0, 0, 0, 0, 0, 1, 0, 0, 2200,
  ],
  'popup-close': [
    0.24, 0, 495, 0.01, 0.04, 0.1, 1, 1, 0, 0, -165, 0.05, 0, 0, 0, 0, 0, 1, 0, 0, 2200,
  ],
  alarm: [0.28, 0, 620, 0.01, 0.14, 0.08, 1, 1, 0, 0, -180, 0.08, 0, 0, 0, 0, 0, 1, 0, 0, 2200],
  success: [
    0.32, 0, 523, 0.02, 0.1, 0.32, 1, 1, 0, 0, 262, 0.07, 0.14, 0, 0, 0, 0, 0.8, 0, 0, 3000,
  ],
  fail: [0.3, 0, 240, 0.02, 0.2, 0.3, 2, 1, -2.5, 0, -40, 0.12, 0, 0.1, 0, 0, 0, 0.7, 0, 0, 900],
  launch: [0.5, 0, 55, 0.3, 1.6, 1.8, 4, 1, 0.3, 0, 0, 0, 0, 1.2, 0, 0, 0, 0.8, 0.2, 0.1, 400],
  'countdown-beep': [0.22, 0, 660, 0, 0.06, 0.05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2500],
  radio: [0.14, 0, 900, 0, 0.12, 0.06, 4, 1, 0, 0, 0, 0, 0, 4, 0, 0.1, 0, 0.6, 0, 0.3, 2400],
  'nova-beep': [0.12, 0, 880, 0, 0.022, 0.025, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3000],
  unlock: [0.3, 0, 262, 0.02, 0.16, 0.3, 1, 1, 6, 0, 131, 0.06, 0, 0, 0, 0, 0, 0.8, 0, 0, 2800],
  typewriter: [0.07, 0, 1400, 0, 0.003, 0.012, 4, 1, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0, 2400],
  // Two quick rising blips: "Day X: event!"
  'event-sting': [
    0.26, 0, 440, 0, 0.05, 0.08, 1, 1, 0, 0, 220, 0.05, 0.12, 0, 0, 0, 0, 1, 0, 0, 2600,
  ],
  // Mini-game: a bright double ping for a hit, a low soft thud for a miss.
  'minigame-hit': [
    0.28, 0, 660, 0, 0.04, 0.12, 1, 1, 0, 0, 330, 0.04, 0, 0, 0, 0, 0, 1, 0, 0, 3000,
  ],
  'minigame-miss': [
    0.25, 0, 160, 0, 0.06, 0.14, 1, 1, -1.5, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.8, 0, 0, 700,
  ],
  // Crew tasks: plug click, soft scrub hiss, rising lock-on beep, valve hiss.
  'wire-click': [0.3, 0, 300, 0, 0.01, 0.03, 4, 1, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 1, 0, 0, 1800],
  scrub: [0.08, 0, 600, 0.01, 0.05, 0.06, 4, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0.6, 0, 0, 1400],
  'signal-beep': [0.14, 0, 700, 0, 0.04, 0.05, 0, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2600],
  'valve-hiss': [0.07, 0, 400, 0.02, 0.1, 0.1, 4, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0.5, 0, 0, 1200],
  // Pending problem: a soft two-tone beep every few seconds (alert layer).
  'alert-beep': [0.12, 0, 740, 0, 0.05, 0.06, 0, 1, 0, 0, -120, 0.06, 0, 0, 0, 0, 0, 1, 0, 0, 2400],
}

/** How much a sound's pitch may wander per play (0 = never); the rest play the same each time. */
const PITCH_JITTER: Partial<Record<SoundId, number>> = { footstep: 0.12, 'nova-beep': 0.25 }
/** The alarm repeats this many times, this far apart (ms). */
const ALARM_REPEATS = 3
const ALARM_GAP_MS = 260

const cache = new Map<SoundId, number[]>()
const jitter = createRng(1977)

export function isSoundId(id: string): id is SoundId {
  return (SOUND_IDS as readonly string[]).includes(id)
}

// ZzFX creates its AudioContext on import, so it loads lazily (never in tests or before a click).
let ZZFX: typeof ZzfxApi | null = null
let loading: Promise<typeof ZzfxApi | null> | null = null

/** Loads ZzFX once; resolves null when audio is unavailable. */
export function loadAudio(): Promise<typeof ZzfxApi | null> {
  loading ??= import('zzfx').then((m) => (ZZFX = m.ZZFX)).catch(() => null)
  return loading
}

/** The shared audio context once loaded (resumed after the first user gesture). */
export function audioContext(): AudioContext | null {
  return ZZFX?.audioContext ?? null
}

/** Plays a generated sound at the given volume (0-1). Never throws. */
export function playSfx(id: SoundId, volume: number): void {
  if (!ZZFX) {
    void loadAudio()
    return
  }
  const zz = ZZFX
  try {
    let samples = cache.get(id)
    if (!samples) {
      samples = zz.buildSamples(...SOUNDS[id])
      cache.set(id, samples)
    }
    const j = PITCH_JITTER[id] ?? 0
    const rate = 1 + (jitter.next() * 2 - 1) * j
    const play = () => zz.playSamples([samples], volume, rate)
    play()
    if (id === 'alarm') for (let i = 1; i < ALARM_REPEATS; i++) setTimeout(play, i * ALARM_GAP_MS)
  } catch {
    // Audio unavailable (no context, blocked): stay silent.
  }
}
