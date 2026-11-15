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
