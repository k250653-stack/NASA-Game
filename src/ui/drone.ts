/**
 * Generated ambient space drone (used when no music file exists): low detuned oscillators
 * through a low-pass filter whose cutoff sweeps slowly. Very quiet; fades in and out.
 */

export interface DroneVoice {
  /** Root frequency, Hz. */
  base: number
  /** Filter centre, Hz. */
  filter: number
  /** Filter sweep speed, Hz. */
  sweep: number
}

/** A slightly different colour per scene; "tension" is brighter and moves faster. */
export const DRONE_VOICES: Record<string, DroneVoice> = {
  menu: { base: 55, filter: 320, sweep: 0.05 },
  hq: { base: 49, filter: 300, sweep: 0.04 },
  mission: { base: 41.2, filter: 260, sweep: 0.03 },
  tension: { base: 58.3, filter: 520, sweep: 0.22 },
  debrief: { base: 65.4, filter: 340, sweep: 0.05 },
}
const DEFAULT_VOICE: DroneVoice = { base: 49, filter: 300, sweep: 0.04 }

/** Loudness of the drone at full music volume; it should sit far behind everything else. */
const DRONE_LEVEL = 0.06

export interface Drone {
  setVolume: (volume: number) => void
  stop: (fadeS: number) => void
}

export function startDrone(ctx: AudioContext, track: string, volume: number, fadeS: number): Drone {
  const v = DRONE_VOICES[track] ?? DEFAULT_VOICE
  const now = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(DRONE_LEVEL * volume, now + fadeS)
  out.connect(ctx.destination)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = v.filter
  filter.Q.value = 4
  filter.connect(out)

  // Slow sweep of the filter cutoff.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = v.sweep
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = v.filter * 0.6
  lfo.connect(lfoDepth).connect(filter.frequency)

  const voices: Array<[OscillatorType, number, number]> = [
    ['sine', v.base, 0.5],
    ['sine', v.base * 1.006, 0.45],
    ['triangle', v.base * 1.5, 0.18],
    ['sine', v.base / 2, 0.35],
  ]
  const oscs = voices.map(([type, freq, level]) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = level
    o.connect(g).connect(filter)
    o.start()
    return o
  })
  lfo.start()

  return {
    setVolume: (vol) => out.gain.setTargetAtTime(DRONE_LEVEL * vol, ctx.currentTime, 0.3),
    stop: (fade) => {
      const t = ctx.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(out.gain.value, t)
      out.gain.linearRampToValueAtTime(0, t + fade)
      for (const o of [...oscs, lfo]) o.stop(t + fade + 0.05)
    },
  }
}

/** Calm pad for HQ and habitat: three slow chords (Hz) with a soft arpeggio on top. */
const PAD_CHORDS: readonly (readonly number[])[] = [
  [110, 164.8, 220, 261.6], // A minor
  [87.3, 130.8, 174.6, 220], // F major
  [98, 146.8, 196, 246.9], // G major
]
const PAD_LEVEL = 0.05
/** Seconds per chord, and per arpeggio note. */
const CHORD_S = 8
const ARP_S = 0.5

/** Generated ambient synth pad loop (used for "hq" and "mission" when no mp3 exists). */
export function startPad(ctx: AudioContext, volume: number, fadeS: number): Drone {
  const now = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(PAD_LEVEL * volume, now + fadeS)
  out.connect(ctx.destination)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  filter.connect(out)
  const voices = PAD_CHORDS[0]!.map((f) => {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.value = 0.18
    o.connect(g).connect(filter)
    o.start()
    return o
  })
  const arp = ctx.createOscillator()
  arp.type = 'sine'
  const arpGain = ctx.createGain()
  arpGain.gain.value = 0
  arp.connect(arpGain).connect(filter)
  arp.start()
  let chord = 0
  let step = 0
  const chordTimer = setInterval(() => {
    chord = (chord + 1) % PAD_CHORDS.length
    const t = ctx.currentTime
    PAD_CHORDS[chord]!.forEach((f, i) => voices[i]!.frequency.setTargetAtTime(f, t, 1.2))
  }, CHORD_S * 1000)
  const arpTimer = setInterval(() => {
    const notes = PAD_CHORDS[chord]!
    const t = ctx.currentTime
    arp.frequency.setValueAtTime(notes[step++ % notes.length]! * 2, t)
    arpGain.gain.setValueAtTime(0.12, t)
    arpGain.gain.exponentialRampToValueAtTime(0.001, t + ARP_S * 0.9)
  }, ARP_S * 1000)
  return {
    setVolume: (vol) => out.gain.setTargetAtTime(PAD_LEVEL * vol, ctx.currentTime, 0.3),
    stop: (fade) => {
      clearInterval(chordTimer)
      clearInterval(arpTimer)
      const t = ctx.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(out.gain.value, t)
      out.gain.linearRampToValueAtTime(0, t + fade)
      for (const o of [...voices, arp]) o.stop(t + fade + 0.05)
    },
  }
}
