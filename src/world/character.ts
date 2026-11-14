/**
 * Astronaut sprite sheets (public/assets/sprites/maincharacter/*.png).
 * Each sheet is ONE row of 30 frames, 258x258 each: 5 drawn directions x 6 frames, in the
 * order S, SE, E, NE, N. The other three directions are mirrors: SW = SE, W = E, NW = NE.
 */
export const FRAME_SIZE = 258
export const FRAMES_PER_DIR = 6
/** Where the boots touch the ground / top of the helmet, in frame pixels. */
export const FOOT_Y = 170
export const HEAD_Y = 72

export type Motion = 'idle' | 'walk' | 'run'
export const MOTIONS: readonly Motion[] = ['idle', 'walk', 'run']
/** Sheet file name (without .png) per motion. */
export const SHEET_FILE: Record<Motion, string> = { idle: 'IDLE', walk: 'WALKING', run: 'RUN' }
export const FRAME_RATE: Record<Motion, number> = { idle: 6, walk: 10, run: 14 }

export const SHEET_DIRS = ['S', 'SE', 'E', 'NE', 'N'] as const
export type SheetDir = (typeof SHEET_DIRS)[number]
export type Facing = SheetDir | 'SW' | 'W' | 'NW'

const MIRRORED: Partial<Record<Facing, SheetDir>> = { SW: 'SE', W: 'E', NW: 'NE' }

/** Which drawn direction to use for a facing, and whether to flip it horizontally. */
export function sheetDir(facing: Facing): { dir: SheetDir; flip: boolean } {
  const mirror = MIRRORED[facing]
  return mirror ? { dir: mirror, flip: true } : { dir: facing as SheetDir, flip: false }
}

const OCTANTS: readonly Facing[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']

/** Screen-space input/velocity (y down) to one of 8 facings. */
export function facingFrom(dx: number, dy: number): Facing {
  const octant = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
  return OCTANTS[octant]!
}

export function animKey(motion: Motion, dir: SheetDir): string {
  return `${motion}-${dir}`
}
