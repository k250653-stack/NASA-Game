/**
 * Generated ambient beds (Web Audio + ZzFX, no files): a quiet layered loop per place, with
 * occasional details timed by the seeded rng. Plus a positional station hum the scenes set by
 * distance. Everything is low and soft; levels follow the sound volume / mute settings.
 */
import { createRng, type Rng } from '@/engine/rng'
import { useSettings } from './settingsStore'
import { loadAudio } from './sfx'
import { playSound } from './sound'

export type AmbienceKind = 'hq' | 'moon' | 'mars' | 'launch'

/** Bed loudness at full sound volume (kept very low), and the station hum's maximum. */
const BED_LEVEL = 0.035
const HUM_LEVEL = 0.025
const FADE_S = 1.2

interface Bed {
  kind: AmbienceKind
  out: GainNode
  stop: () => void
}

let bed: Bed | null = null
let hum: { gain: GainNode; osc: OscillatorNode } | null = null
let token = 0

function soundLevel(): number {
  const s = useSettings.getState()
  return s.soundOn ? s.soundVolume * (s.masterVolume ?? 1) : 0
}

/** Seeded noise buffer (no Math.random). */
function noise(ctx: AudioContext, seed: number): AudioBuffer {
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  const rng = createRng(seed)
  for (let i = 0; i < len; i++) d[i] = rng.next() * 2 - 1
  return buf
}

function build(ctx: AudioContext, kind: AmbienceKind): Bed {
  const now = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(BED_LEVEL * soundLevel(), now + FADE_S)
  out.connect(ctx.destination)
  const stops: Array<() => void> = []
  const timers: Array<ReturnType<typeof setTimeout>> = []

  const tone = (freq: number, gain: number, type: OscillatorType = 'sine') => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = gain
    o.connect(g).connect(out)
    o.start()
    stops.push(() => o.stop())
    return g
  }
  const noiseBed = (seed: number, type: BiquadFilterType, freq: number, gain: number) => {
    const src = ctx.createBufferSource()
    src.buffer = noise(ctx, seed)
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(f).connect(g).connect(out)
    src.start()
    stops.push(() => src.stop())
    return { g, f }
  }
  /** Repeats `fn` at seeded random intervals between min and max seconds. */
  const every = (rng: Rng, minS: number, maxS: number, fn: () => void) => {
    const next = () => {
      const t = setTimeout(
        () => {
          fn()
          next()
        },
        (minS + rng.next() * (maxS - minS)) * 1000,
      )
      timers.push(t)
    }
    next()
  }
  const rng = createRng(kind.length * 977 + 13)

  if (kind === 'hq') {
    noiseBed(11, 'lowpass', 500, 0.5) // room tone
    tone(60, 0.25)
    tone(120, 0.08) // distant computer hum
    every(rng, 4, 10, () => playSound('ui-blip')) // consoles
    every(rng, 45, 80, () => playSound('announce')) // far-off launchpad chime
  } else if (kind === 'moon' || kind === 'mars') {
    tone(52, 0.3)
    tone(104, 0.1, 'triangle') // life-support hum
    noiseBed(23, 'bandpass', 1800, 0.08) // faint radio static
    every(rng, 18, 24, () => playSound('recycler'))
    every(rng, 12, 30, () => playSound('creak'))
    if (kind === 'mars') {
      // Wind gusts: low noise whose loudness swells slowly.
      const wind = noiseBed(37, 'lowpass', 320, 0.4)
      const l = ctx.createOscillator()
      l.frequency.value = 0.07
      const depth = ctx.createGain()
      depth.gain.value = 0.35
      l.connect(depth).connect(wind.g.gain)
      l.start()
      stops.push(() => l.stop())
      every(rng, 2, 6, () => playSound('dust-tick'))
    }
  } else {
    // Launch: deep rumble that settles into a calm space drone.
    const r = noiseBed(51, 'lowpass', 140, 1)
    r.g.gain.setValueAtTime(1, now)
    r.g.gain.linearRampToValueAtTime(0.05, now + 8)
    tone(41, 0.25)
    tone(61.7, 0.15)
  }

  return {
    kind,
    out,
    stop: () => {
      timers.forEach(clearTimeout)
      const t = ctx.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(out.gain.value, t)
      out.gain.linearRampToValueAtTime(0, t + FADE_S)
      setTimeout(() => stops.forEach((s) => s()), FADE_S * 1000 + 50)
    },
  }
}

/** The bed for the current place, or null for silence. */
export async function setAmbience(kind: AmbienceKind | null): Promise<void> {
  if ((bed?.kind ?? null) === kind) return
  const my = ++token
  bed?.stop()
  bed = null
  if (!kind) return
  const zz = await loadAudio()
  if (my !== token || !zz) return
  try {
    bed = build(zz.audioContext, kind)
  } catch {
    bed = null
  }
}

/** Positional station hum: 0 (far) .. 1 (right next to a station). Called by the scenes. */
export function setStationHum(closeness: number): void {
  void loadAudio().then((zz) => {
    if (!zz) return
    const ctx = zz.audioContext
    if (!hum) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = 176
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      hum = { gain, osc }
    }
    const v = Math.max(0, Math.min(1, closeness)) * HUM_LEVEL * soundLevel()
    hum.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.25)
  })
}

// Volume and mute changes apply straight away.
useSettings.subscribe(() => {
  if (bed) bed.out.gain.setTargetAtTime(BED_LEVEL * soundLevel(), bed.out.context.currentTime, 0.2)
})
