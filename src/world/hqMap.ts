/**
 * The HQ as one connected map (rooms/hq-map.json over public/assets/backgrounds/hq-map.png):
 * room floors, the open doorways between them, furniture, stations and the outdoor path.
 * Every coordinate is a map-image pixel = a world pixel. Pure TS, validated with Zod.
 */
import { z } from 'zod'
import { IMAGE_KINDS } from '@/ui/assets'
import { centroid, type Point, type Polygon } from './geometry'
import mapJson from './rooms/hq-map.json'
import { STEPS, type Step } from './rooms/room'

const point = z.tuple([z.number(), z.number()])
const polygon = z.array(point).min(3)

/** What a station opens: a mission step's screens. */
export type StationOpens = Step

const mapSchema = z.object({
  image: z.object({ kind: z.enum(IMAGE_KINDS), id: z.string(), ext: z.string() }),
  size: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  /** Where a new game starts: on the stone path outside the front entrance. */
  spawn: point,
  /** Walkable outside the building (only the entrance path). */
  outdoor: z.array(polygon),
  rooms: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      /** Locked until this step is reachable (see steps.ts); none = always open. */
      gate: z.enum(STEPS).optional(),
      floor: polygon,
    }),
  ),
  doorways: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      /** Theme colour token of the door frame, e.g. "role-comms". */
      color: z.string(),
      /** The room this doorway leads into from the lobby (its gate locks the doorway). */
      room: z.string(),
      /** Floor strip through the door opening, overlapping both floors. */
      area: polygon,
    }),
  ),
  blocked: z.array(polygon),
  /**
   * Parts of the picture drawn again IN FRONT of the player when the player stands behind them
   * (door frames, front low walls, tall furniture): a masked copy of the map clipped to `area`,
   * depth-sorted by `baseY` (the floor line the object stands on) against the player's foot Y.
   */
  occluders: z.array(z.object({ id: z.string(), baseY: z.number(), area: polygon })),
  stations: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      room: z.string(),
      opens: z.enum(STEPS),
      area: polygon,
      /** How close (px) the player's feet must be to use it. */
      reach: z.number().positive().default(48),
    }),
  ),
  /** Debrief: where the crew stand round the meeting table, and where the player arrives. */
  tableSpots: z.array(point),
  tableCenter: point,
  briefingArrival: point,
})

/** The raw JSON (what the hitbox editor edits and saves). */
export type HqMapJson = z.infer<typeof mapSchema>
type MapJson = HqMapJson

export interface HqRoom {
  id: string
  name: string
  gate: Step | undefined
  floor: Polygon
  /** Floor centre (camera target, padlock position). */
  center: Point
}

export interface HqDoorway {
  id: string
  label: string
  color: string
  room: string
  area: Polygon
}

export interface HqStation {
  key: string
  label: string
  room: string
  opens: StationOpens
  area: Polygon
  reach: number
}

export interface HqOccluder {
  id: string
  /** Outline in world pixels. */
  shape: Polygon
  /** Floor line: the player is behind the object when their feet are above this y. */
  baseY: number
}

export interface HqMap {
  image: MapJson['image']
  size: readonly [number, number]
  spawn: Point
  outdoor: Polygon[]
  rooms: HqRoom[]
  doorways: HqDoorway[]
  blocked: Polygon[]
  occluders: HqOccluder[]
  stations: HqStation[]
  tableSpots: Point[]
  tableCenter: Point
  briefingArrival: Point
}

export const LOBBY_ROOM = 'lobby'

let cached: HqMap | null = null

/** The map as shipped (src/world/rooms/hq-map.json). */
export function getHqMap(): HqMap {
  cached ??= buildHqMap(mapJson)
  return cached
}

/** A deep copy of the shipped JSON, for the hitbox editor to change. */
export function rawHqMap(): HqMapJson {
  return mapSchema.parse(structuredClone(mapJson))
}

/** Validates map JSON (shipped or edited) and derives what the scene needs. */
export function buildHqMap(json: unknown): HqMap {
  const m = mapSchema.parse(json)
  const roomIds = new Set(m.rooms.map((r) => r.id))
  for (const d of m.doorways) {
    if (!roomIds.has(d.room))
      throw new Error(`hq-map.json: doorway ${d.id} leads to unknown room ${d.room}`)
  }
  return {
    image: m.image,
    size: m.size,
    spawn: m.spawn as Point,
    outdoor: m.outdoor as Polygon[],
    rooms: m.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      gate: r.gate,
      floor: r.floor as Polygon,
      center: centroid(r.floor as Polygon),
    })),
    doorways: m.doorways.map((d) => ({ ...d, area: d.area as Polygon })),
    blocked: m.blocked as Polygon[],
    occluders: m.occluders.map((o) => ({ id: o.id, shape: o.area as Polygon, baseY: o.baseY })),
    stations: m.stations.map((s) => ({
      key: s.id,
      label: s.label,
      room: s.room,
      opens: s.opens,
      area: s.area as Polygon,
      reach: s.reach,
    })),
    tableSpots: m.tableSpots as Point[],
    tableCenter: m.tableCenter as Point,
    briefingArrival: m.briefingArrival as Point,
  }
}

/** Rooms that lock until a step is reachable, each with its gate. */
export function gatedRooms(map: HqMap): { roomId: string; gate: Step }[] {
  return map.rooms.flatMap((r) => (r.gate ? [{ roomId: r.id, gate: r.gate }] : []))
}
