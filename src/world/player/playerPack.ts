/**
 * Main player art (public/assets/player, from the player pack): two appearances, cabin/eva suits,
 * eight directions with no mirroring. Pure TypeScript, no Phaser. The maths below follows the
 * pack's canvas adapter (facingFromScreenVector, groundVelocity, getPlayerFrame).
 *
 * Layout of every atlas: rows N, NE, E, SE, S, SW, W, NW; columns = frames (idle 8, walk 12).
 */
import { getContent } from '@/content/load'

export const PLAYER_APPEARANCES = ['player_female', 'player_male'] as const
export type PlayerAppearance = (typeof PLAYER_APPEARANCES)[number]
export const DEFAULT_APPEARANCE: PlayerAppearance = 'player_female'

/** cabin = helmet off (pressurised); eva = sealed helmet (outside a vehicle or habitat). */
export const PLAYER_VARIANTS = ['cabin', 'eva'] as const
export type PlayerVariant = (typeof PLAYER_VARIANTS)[number]

export type PlayerAction = 'idle' | 'walk'

export const PLAYER_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type PlayerDirection = (typeof PLAYER_DIRECTIONS)[number]

/** Display name and height shown on the choice screen. */
export const APPEARANCE_INFO: Record<PlayerAppearance, { label: string; heightCm: number }> = {
  player_female: { label: 'Female astronaut', heightCm: 170 },
  player_male: { label: 'Male astronaut', heightCm: 178 },
}

export function isPlayerAppearance(v: unknown): v is PlayerAppearance {
  return (PLAYER_APPEARANCES as readonly unknown[]).includes(v)
}

// ---- manifest (only the parts the game reads) --------------------------------------------------

export interface PlayerSheet {
  player: PlayerAppearance
  variant: PlayerVariant
  action: PlayerAction
  /** Path of the half-size ("compact") atlas, relative to /assets/player/. */
  compactPath: string
  frameCount: number
  fps: number
}

export interface PlayerManifest {
  /** Compact frame size and foot pivot, in compact pixels. */
  compactFrame: { width: number; height: number; origin: { x: number; y: number } }
  projection: { pixelsPerUnit: number; groundYScale: number }
  movement: { worldUnitsPerSecond: number }
  sheets: PlayerSheet[]
}

export function playerAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/player/${path}`
}

export const MANIFEST_URL = playerAssetUrl('manifest.json')

export function findSheet(
  m: PlayerManifest,
  player: PlayerAppearance,
  variant: PlayerVariant,
  action: PlayerAction,
): PlayerSheet {
  const sheet = m.sheets.find(
    (s) => s.player === player && s.variant === variant && s.action === action,
  )
  if (!sheet) throw new Error(`Player pack: no ${player}/${variant}/${action} sheet`)
  return sheet
}

/** Texture key for a loaded sheet. */
export function sheetKey(player: PlayerAppearance, variant: PlayerVariant, action: PlayerAction) {
  return `player-${player}-${variant}-${action}`
}

// ---- movement and animation maths -------------------------------------------------------------

/**
 * The pack's yaw for each direction (S = 0, clockwise on screen). Rows are N..NW, so the sector
 * names below are indexed by the rounded atan2(x, 2y) octant.
 */
const SECTORS: readonly PlayerDirection[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
const YAW_DEG: Record<PlayerDirection, number> = {
  S: 0,
  SE: 45,
  E: 90,
  NE: 135,
  N: 180,
  NW: 225,
  W: 270,
  SW: 315,
}

/** Screen vector (deprojected: y counts double) to a compass sector; zero keeps `previous`. */
export function facingFromScreenVector(
  x: number,
  y: number,
  previous: PlayerDirection = 'S',
): PlayerDirection {
  if (x === 0 && y === 0) return previous
  const sector = Math.round(Math.atan2(x, y * 2) / (Math.PI / 4))
  return SECTORS[(sector + 8) % 8]!
}

/**
 * Keys are ground-plane intent (right = E, down = S, right+down = SE), so a held key pair
 * gives the diagonal sector. Same as facingFromScreenVector with the y part pre-halved.
 */
export function facingFromKeys(dx: number, dy: number, previous: PlayerDirection): PlayerDirection {
  return facingFromScreenVector(dx, dy / 2, previous)
}

/** Master-pixel velocity (pixels/second) of the walk cycle in the given direction. */
export function groundVelocity(m: PlayerManifest, direction: PlayerDirection) {
  const a = (YAW_DEG[direction] * Math.PI) / 180
  const v = m.movement.worldUnitsPerSecond * m.projection.pixelsPerUnit
  return { x: Math.sin(a) * v, y: Math.cos(a) * m.projection.groundYScale * v }
}

/** Compact atlases are half the master size, so master velocity is halved. */
export const COMPACT_SCALE = 0.5

/**
 * The pack's walk speed is slow for these big rooms, so the walk is played faster: animation
 * rate and movement are multiplied by the same factor, which keeps the feet planted.
 * Values live in content (constants.player); sprint = walk x sprintMultiplier.
 */
export function speedFactor(running: boolean): number {
  const p = getContent().constants.player
  return running ? p.walkSpeedFactor * p.sprintMultiplier : p.walkSpeedFactor
}

/** Index into a row-major spritesheet (8 rows of `frameCount` columns). */
export function frameIndex(
  direction: PlayerDirection,
  elapsedMs: number,
  fps: number,
  frameCount: number,
): number {
  const row = PLAYER_DIRECTIONS.indexOf(direction)
  const col = Math.floor((Math.max(0, elapsedMs) * fps) / 1000) % frameCount
  return row * frameCount + col
}

/** Half a walk cycle (one footfall), in ms, at the given speed factor. */
export function footfallMs(speedFactor: number): number {
  return 600 / speedFactor
}

// ---- loading the manifest outside Phaser (React previews) ---------------------------------------

let manifestPromise: Promise<PlayerManifest> | null = null

/** Fetches /assets/player/manifest.json once. */
export function loadPlayerManifest(): Promise<PlayerManifest> {
  manifestPromise ??= fetch(MANIFEST_URL).then((r) => {
    if (!r.ok) throw new Error(`Player pack manifest: HTTP ${r.status}`)
    return r.json() as Promise<PlayerManifest>
  })
  return manifestPromise
}
