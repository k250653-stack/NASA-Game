/**
 * The HQ building: every room from rooms/hq-map.json placed on one world canvas, and the door
 * portals between them (each door's `to` + `arrive` in its room JSON). WORLD pixels. Pure TS.
 */
import { z } from 'zod'
import { centroid, pointInPolygon, translate, type Point, type Polygon } from './geometry'
import mapJson from './rooms/hq-map.json'
import { getRoom, LOBBY_ID, type Door, type Room, type Step } from './rooms/room'

const mapSchema = z.object({
  /** Room image top-left corners in world pixels. */
  rooms: z.array(z.object({ id: z.string(), at: z.tuple([z.number(), z.number()]) })),
})

export interface PlacedStation {
  key: string
  label: string
  opens: Step
  area: Polygon
  reach: number
}

export interface PlacedDoor {
  /** "roomId/doorId" */
  key: string
  roomId: string
  door: Door
  area: Polygon
  /** Where the player stands after arriving through this door (on the floor, just outside it). */
  arrival: Point
  /** Key of the door this one leads to (null if its room is not on the map). */
  target: string | null
}

export interface PlacedRoom {
  room: Room
  at: Point
  floors: Polygon[]
  blocked: Polygon[]
  stations: PlacedStation[]
  doors: PlacedDoor[]
  /** Floor centre in world pixels (camera target). */
  center: Point
}

export interface HqMap {
  rooms: PlacedRoom[]
  lobby: PlacedRoom
  doors: Map<string, PlacedDoor>
}

/** Walk from the door towards the room centre until on free floor and clear of the door. */
function arrivalPoint(area: Polygon, floors: Polygon[], blocked: Polygon[], center: Point): Point {
  const from = centroid(area)
  for (let t = 0; t <= 1; t += 0.01) {
    const p: Point = [from[0] + (center[0] - from[0]) * t, from[1] + (center[1] - from[1]) * t]
    const onFloor = floors.some((f) => pointInPolygon(p, f)) && !blocked.some((b) => pointInPolygon(p, b))
    if (onFloor && !pointInPolygon(p, area)) {
      // A little further in, so the player does not stand on the threshold.
      const s = Math.min(1, t + 0.06)
      return [from[0] + (center[0] - from[0]) * s, from[1] + (center[1] - from[1]) * s]
    }
  }
  return center
}

function place(room: Room, at: Point, onMap: Set<string>): PlacedRoom {
  const floors = room.walkable.map((p) => translate(p as Polygon, at))
  const blocked = room.blocked.map((p) => translate(p as Polygon, at))
  const center = centroid(floors[0]!)
  return {
    room,
    at,
    floors,
    blocked,
    center,
    stations: room.stations.map((s) => ({
      key: `${room.id}/${s.id}`,
      label: s.label,
      opens: s.opens,
      area: translate(s.area as Polygon, at),
      reach: s.reach,
    })),
    doors: room.doors.map((d) => {
      const area = translate(d.area as Polygon, at)
      return {
        key: `${room.id}/${d.id}`,
        roomId: room.id,
        door: d,
        area,
        arrival: arrivalPoint(area, floors, blocked, center),
        target: onMap.has(d.to) && d.arrive ? `${d.to}/${d.arrive}` : null,
      }
    }),
  }
}

let cached: HqMap | null = null

export function getHqMap(): HqMap {
  if (cached) return cached
  const map = mapSchema.parse(mapJson)
  const onMap = new Set(map.rooms.map((r) => r.id))
  const rooms = map.rooms.map((r) => place(getRoom(r.id), r.at as Point, onMap))
  const lobby = rooms.find((r) => r.room.id === LOBBY_ID)
  if (!lobby) throw new Error('hq-map.json: the lobby must be placed')
  const doors = new Map(rooms.flatMap((r) => r.doors.map((d) => [d.key, d] as const)))
  for (const d of doors.values()) {
    if (d.target && !doors.has(d.target)) throw new Error(`Door ${d.key} leads to unknown door ${d.target}`)
  }
  cached = { rooms, lobby, doors }
  return cached
}

/** Rooms behind a gated lobby door, with that door (for lock reasons). */
export function gatedRooms(map: HqMap): { roomId: string; door: Door }[] {
  return map.lobby.doors.filter((d) => d.door.gate && d.target).map((d) => ({ roomId: d.door.to, door: d.door }))
}
