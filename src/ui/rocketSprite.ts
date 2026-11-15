import type { Rocket } from '@/schemas'

/** "rocket-light" / "rocket-medium" / "rocket-heavy" sprite id (super heavy uses heavy). */
export function rocketSprite(rocket: Pick<Rocket, 'id'>): string {
  const size = ['light', 'medium', 'heavy'].find((s) => rocket.id.startsWith(s)) ?? 'heavy'
  return `rocket-${size}`
}
