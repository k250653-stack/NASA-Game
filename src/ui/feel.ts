/** Small "game feel" effects shared by screens and scenes. */
import { useSettings } from './settingsStore'

/** True when the player or the OS asked for less motion. */
export function reducedMotion(): boolean {
  if (useSettings.getState().reducedMotion) return true
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Shakes the whole screen briefly (launch, impacts). Does nothing with reduced motion. */
export function shakeScreen(): void {
  if (reducedMotion()) return
  const root = document.getElementById('root')
  if (!root) return
  root.classList.remove('screen-shake')
  void root.offsetWidth // restart the animation
  root.classList.add('screen-shake')
  root.addEventListener('animationend', () => root.classList.remove('screen-shake'), { once: true })
}
