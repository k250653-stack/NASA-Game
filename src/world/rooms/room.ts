/**
 * Walkable room layouts (src/world/rooms/*.json), validated with Zod on first use.
 * All coordinates are room-image pixels; press F2 in a room to see and measure them.
 */
import { z } from 'zod'
import { IMAGE_KINDS } from '@/ui/assets'
import hqLobbyJson from './hq-lobby.json'

const point = z.tuple([z.number(), z.number()])
const polygon = z.array(point).min(3)

export const DOOR_TARGETS = ['planning', 'personnel', 'briefing', 'launch'] as const

const doorSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Theme colour token name (index.css), e.g. "role-comms", "success". */
  color: z.string(),
  area: polygon,
  target: z.enum(DOOR_TARGETS),
  /** Locked regardless of game progress. */
  locked: z.boolean(),
  lockedReason: z.string().optional(),
})

const roomSchema = z.object({
  id: z.string(),
  image: z.object({ kind: z.enum(IMAGE_KINDS), id: z.string(), ext: z.string() }),
  /** Image size in pixels. */
  size: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  /** Part of the image that must stay visible on screens too small for 1x (it is shrunk). */
  fit: z.tuple([z.number().positive(), z.number().positive()]),
  /** Character sprite scale in room pixels. */
  playerScale: z.number().positive(),
  walkable: polygon,
  blocked: z.array(polygon),
  doors: z.array(doorSchema),
  stations: z.array(z.unknown()),
})

export type Room = z.infer<typeof roomSchema>
export type Door = z.infer<typeof doorSchema>
export type DoorTarget = Door['target']

let hqLobby: Room | null = null

export function getHqLobby(): Room {
  hqLobby ??= roomSchema.parse(hqLobbyJson)
  return hqLobby
}
