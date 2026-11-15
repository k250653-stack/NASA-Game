import { AssetImage } from '@/ui/AssetImage'
import { useSettings } from '@/ui/settingsStore'
import { LAUNCH, riseProgress } from './menuLaunch'
import { MenuRocket } from './MenuRocket'

interface MenuBackgroundProps {
  /** Ms since the menu launch started (PLAY / SANDBOX), or null while idle. */
  launchT?: number | null
}

/**
 * Full-screen pixel-art backdrop, darkened on the left so the menu text stays readable. During
 * the launch the whole scene shakes briefly at ignition and dims as the rocket climbs away.
 */
export function MenuBackground({ launchT = null }: MenuBackgroundProps) {
  const reduced = useSettings((s) => s.reducedMotion)
  const t = launchT
  const sinceIgnition = t === null ? -1 : t - LAUNCH.ignition
  const shaking = !reduced && sinceIgnition >= 0 && sinceIgnition < LAUNCH.shakeMs
  // Whole-pixel shake that dies down; deterministic from the clock.
  const amp = shaking ? Math.round(4 * (1 - sinceIgnition / LAUNCH.shakeMs)) : 0
  const shake = amp
    ? `translate(${(Math.floor(sinceIgnition / 35) % 2 ? 1 : -1) * amp}px, ${(Math.floor(sinceIgnition / 50) % 2 ? 1 : -1) * Math.ceil(amp / 2)}px)`
    : undefined
  const dim = t === null ? 0 : riseProgress(t) * 0.55

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-bg"
      aria-hidden
      data-testid="menu-background"
    >
      <div className="absolute inset-0" style={{ transform: shake }}>
        <AssetImage
          kind="backgrounds"
          id="menu-launchpad"
          ext="png"
          alt=""
          className="absolute inset-0 size-full object-cover object-right [image-rendering:pixelated]"
        />
        <MenuRocket launchT={t} />
        <div className="absolute inset-0 bg-linear-to-r from-bg via-bg/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-bg/80 to-transparent" />
        {dim > 0 && <div className="absolute inset-0 bg-bg" style={{ opacity: dim }} />}
      </div>
    </div>
  )
}
