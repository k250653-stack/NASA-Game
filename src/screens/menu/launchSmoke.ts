/**
 * Chunky pixel smoke for the menu launch, computed from the launch clock (no particles state, no
 * randomness): countdown vapour at the base, clouds billowing sideways along the pad at
 * ignition, and a trail left behind as the rocket climbs. Sizes and positions snap to `px`.
 */
import { LAUNCH, riseProgress } from './menuLaunch'

export interface Puff {
  key: string
  x: number
  y: number
  size: number
  opacity: number
  /** Theme colour class. */
  tone: 'bg-primary' | 'bg-muted' | 'bg-subtle'
}

const snap = (v: number, px: number) => Math.round(v / px) * px
/** A fixed pseudo-random spread per index (deterministic). */
const spread = (i: number) => ((i * 37) % 11) / 10

/**
 * All puffs alive at time `t`. (baseX, baseY) = foot of the rocket on the pad, `px` = one art
 * pixel on screen, `travel` = how far the rocket climbs in total.
 */
export function launchPuffs(t: number, baseX: number, baseY: number, px: number, travel: number) {
  const out: Puff[] = []
  const add = (key: string, x: number, y: number, size: number, opacity: number, tone: Puff['tone']) => {
    if (opacity <= 0.02) return
    const s = Math.max(px * 2, snap(size, px * 2))
    out.push({ key, x: snap(x - s / 2, px), y: snap(y - s / 2, px), size: s, opacity, tone })
  }

  // Countdown: vapour at the base grows with every beep.
  for (let i = 0; i < 12; i++) {
    const born = LAUNCH.textFadeMs + i * 90
    const age = t - born
    const life = 900
    if (age < 0 || age > life || born > LAUNCH.ignition) continue
    const u = age / life
    const side = i % 2 ? 1 : -1
    add(`v${i}`, baseX + side * (6 + u * 18) * px, baseY - u * 14 * px, (3 + u * 6 + i * 0.4) * px, 0.55 * (1 - u), 'bg-primary')
  }

  // Ignition: clouds roll out sideways along the pad.
  for (let i = 0; i < 22; i++) {
    const born = LAUNCH.ignition + i * 55
    const age = t - born
    const life = 2600
    if (age < 0 || age > life) continue
    const u = age / life
    const side = i % 2 ? 1 : -1
    const reach = (50 + spread(i) * 50) * px
    const x = baseX + side * Math.pow(u, 0.55) * reach
    const y = baseY - (2 + spread(i + 3) * 8) * px - u * 10 * px
    const tone = i % 3 === 0 ? 'bg-muted' : 'bg-primary'
    add(`c${i}`, x, y, (8 + u * 18 + spread(i) * 6) * px, 0.8 * (1 - u * u), tone)
  }

  // Lift-off: a trail left where the nozzles were, spreading and fading.
  for (let i = 0; i < 40; i++) {
    const born = LAUNCH.liftoff + i * 60
    const age = t - born
    const life = 1500
    if (age < 0 || age > life || born > LAUNCH.liftoff + LAUNCH.riseMs) continue
    const u = age / life
    const y = baseY - riseProgress(born) * travel
    const x = baseX + (spread(i) - 0.5) * 8 * px * (1 + u * 2)
    add(`t${i}`, x, y + u * 6 * px, (6 + u * 14) * px, 0.6 * (1 - u), i % 2 ? 'bg-subtle' : 'bg-muted')
  }
  return out
}
