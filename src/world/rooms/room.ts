/**
 * Walkable room layouts for the mission habitats (src/world/rooms/*.json except hq-map.json,
 * which is the single HQ map, see hqMap.ts), validated with Zod on first use. Coordinates are
 * room-image pixels; press F2 in a room to see and measure them.
 */
import { z } from 'zod'
import { IMAGE_KINDS } from '@/ui/assets'

/** The four mission steps a lobby door gates and a station opens. */
export const STEPS = ['planning', 'personnel', 'briefing', 'launch'] as const
export type Step = (typeof STEPS)[number]

const point = z.tuple([z.number(), z.number()])
const polygon = z.array(point).min(3)

const doorSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Theme colour token name (index.css), e.g. "role-comms", "success". */
  color: z.string(),
  area: polygon,
  /** Where this door leads (not used as a portal yet). */
  to: z.string(),
  /** Door id in that room to arrive in front of (centre of the floor if missing). */
  arrive: z.string().optional(),
  /** Opens only once this step is reachable (see steps.ts). */
  gate: z.enum(STEPS).optional(),
  /** Locked regardless of game progress. */
  locked: z.boolean(),
  lockedReason: z.string().optional(),
})

const stationSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Outline of the object: glows when the player is near, clickable. */
  area: polygon,
  opens: z.enum(STEPS),
  /** How close (room px) the player's feet must be to use it. */
  reach: z.number().positive().default(48),
})

/** Habitat workstations the mission run uses (crew posts, event actions, the airlock). */
export const WORKSTATION_KINDS = ['power', 'comms', 'science', 'repair', 'airlock'] as const
export type WorkstationKind = (typeof WORKSTATION_KINDS)[number]

const workstationSchema = z.object({
  kind: z.enum(WORKSTATION_KINDS),
  label: z.string(),
  /** Outline of the equipment: glows when the player is near. */
  area: polygon,
  /** Floor spot where a crew member stands to work it. */
  stand: point,
  reach: z.number().positive().default(56),
})

const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.object({ kind: z.enum(IMAGE_KINDS), id: z.string(), ext: z.string() }),
  /** Image size in pixels. */
  size: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  /** Character sprite scale in room pixels. */
  playerScale: z.number().positive(),
  /** Floor polygons the player can stand on (their union). */
  walkable: z.array(polygon).min(1),
  blocked: z.array(polygon),
  doors: z.array(doorSchema),
  stations: z.array(stationSchema),
  workstations: z.array(workstationSchema).default([]),
})

export type Room = z.infer<typeof roomSchema>
export type Door = z.infer<typeof doorSchema>
export type Station = z.infer<typeof stationSchema>
export type Workstation = z.infer<typeof workstationSchema>

const files = import.meta.glob<unknown>(['./*.json', '!./hq-map.json'], {
  eager: true,
  import: 'default',
})
let rooms: Map<string, Room> | null = null

function loadRooms(): Map<string, Room> {
  const map = new Map<string, Room>()
  for (const [path, json] of Object.entries(files)) {
    const result = roomSchema.safeParse(json)
    if (!result.success) throw new Error(`Room ${path}: ${result.error.message}`)
    map.set(result.data.id, result.data)
  }
  return map
}

/** The room with this id (a habitat). */
export function getRoom(id: string): Room {
  rooms ??= loadRooms()
  const room = rooms.get(id)
  if (!room) throw new Error(`Unknown room "${id}"`)
  return room
}
