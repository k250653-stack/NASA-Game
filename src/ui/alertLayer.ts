/**
 * Alert layer while problems are pending: a quiet generated drone per category plus a soft beep
 * every few seconds (content: constants.alert). Fades out when nothing is pending. Follows the
 * sound volume and mute settings. No files; noise comes from the seeded rng (no Math.random).
 */
import { getContent } from '@/content/load'
import { createRng } from '@/engine/rng'
import { useSettings } from './settingsStore'
import { loadAudio } from './sfx'
import { playSound } from './sound'

export type AlertCategory = 'power' | 'comms' | 'crew' | 'environment'

/** Category for an event id (constants.alert.categories), default "power". */
export function alertCategory(eventId: string): AlertCategory {
  const cats = getContent().constants.alert.categories
  for (const k of ['power', 'comms', 'crew', 'environment'] as const)
    if (cats[k].includes(eventId)) return k
  return 'power'
}

interface Layer {
  category: AlertCategory
  out: GainNode
  stop: (fadeS: number) => void
}

let layer: Layer | null = null
let wanted: AlertCategory | null = null
let token = 0
const listeners = new Set<(on: boolean) => void>()

/** Other audio (calm music) can duck while the alert plays. */
export function onAlertChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function level(): number {
  const s = useSettings.getState()
  return s.soundOn ? getContent().constants.alert.level * s.soundVolume : 0
}

function build(ctx: AudioContext, category: AlertCategory): Layer {
  const now = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(level(), now + 0.4)
  out.connect(ctx.destination)
  const stops: Array<() => void> = []
  const osc = (type: OscillatorType, freq: number, gain: number, to: AudioNode) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = gain
    o.connect(g).connect(to)
    o.start()
    stops.push(() => o.stop())
    return { o, g }
  }
  const lfo = (rate: number, depth: number, target: AudioParam) => {
    const l = ctx.createOscillator()
    l.frequency.value = rate
    const d = ctx.createGain()
    d.gain.value = depth
    l.connect(d).connect(target)
    l.start()
    stops.push(() => l.stop())
  }
  let timer: ReturnType<typeof setInterval> | null = null

  if (category === 'power') {
    // Deep pulse: two low sines throbbing about once a second.
    const pulse = ctx.createGain()
    pulse.gain.value = 0.6
    pulse.connect(out)
    osc('sine', 49, 0.7, pulse)
    osc('sine', 98, 0.3, pulse)
    lfo(1.1, 0.4, pulse.gain)
  } else if (category === 'comms') {
    // Morse-like blips: a soft tone gated by a fixed dot/dash pattern.
    const gate = ctx.createGain()
    gate.gain.value = 0
    gate.connect(out)
    osc('triangle', 880, 0.5, gate)
    const pattern = '.-. ..- .- -.. .. ---'
    let i = 0
    timer = setInterval(() => {
      const c = pattern[i++ % pattern.length]
      const t = ctx.currentTime
      if (c === '.' || c === '-') {
        gate.gain.setValueAtTime(1, t)
        gate.gain.setValueAtTime(0, t + (c === '.' ? 0.07 : 0.2))
      }
    }, 260)
  } else if (category === 'crew') {
    // Tense soft tone: two close triangles beating slowly.
    const g = ctx.createGain()
    g.gain.value = 0.5
    g.connect(out)
    osc('triangle', 220, 0.5, g)
    osc('triangle', 226, 0.4, g)
    lfo(0.3, 0.2, g.gain)
  } else {
    // Environment: seeded noise through a band-pass whose centre sweeps slowly (a rumble).
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    const rng = createRng(4242)
    for (let k = 0; k < len; k++) data[k] = rng.next() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 400
    band.Q.value = 1.2
    src.connect(band).connect(out)
    src.start()
    stops.push(() => src.stop())
    lfo(0.15, 280, band.frequency)
  }
  const beep = setInterval(
    () => playSound('alert-beep'),
    getContent().constants.alert.beepEverySec * 1000,
  )
  return {
    category,
    out,
    stop: (fadeS) => {
      if (timer) clearInterval(timer)
      clearInterval(beep)
      const t = ctx.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(out.gain.value, t)
      out.gain.linearRampToValueAtTime(0, t + fadeS)
      setTimeout(() => stops.forEach((s) => s()), fadeS * 1000 + 50)
    },
  }
}

/** Starts (or switches) the alert layer for a category; null fades it out. */
export async function setAlert(category: AlertCategory | null): Promise<void> {
  wanted = category
  if ((layer?.category ?? null) === category) return
  const my = ++token
  const fade = getContent().constants.alert.fadeOutSec
  layer?.stop(fade)
  layer = null
  listeners.forEach((l) => l(category !== null))
  if (!category) return
  const zz = await loadAudio()
  if (my !== token || !zz || wanted !== category) return
  try {
    layer = build(zz.audioContext, category)
  } catch {
    layer = null
  }
}

// Volume and mute changes apply straight away.
useSettings.subscribe(() => {
  if (layer) layer.out.gain.setTargetAtTime(level(), layer.out.context.currentTime, 0.2)
})
