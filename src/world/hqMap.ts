/**
 * The connected HQ: every room from rooms/hq-map.json placed on one world canvas, plus the
 * corridors joining lobby doors to their rooms. Everything here is in WORLD pixels. Pure TS.
 */
import { z } from 'zod'
import { centroid, stripPolygons, translate, type Point, type Polygon } from './geometry'
import mapJson from './rooms/hq-map.json'
import { getRoom, LOBBY_ID, type Door, type Room, type Step } from './rooms/room'

const point = z.tuple([z.number(), z.number()])

const mapSchema = z.object({
  corridorWidth: z.number().positive(),
  /** Room image top-left corners in world pixels. */
  rooms: z.array(z.object({ id: z.string(), at: point })),
  corridors: z.array(
    z.object({
      id: z.string(),
      /** Lobby door the corridor starts at (its gate locks the corridor and the room). */
      door: z.string(),
      room: z.string(),
      /** Centre line in world pixels, lobby door first. */
      path: z.array(point).min(2),
    }),
  ),
})

export interface PlacedStation {
  key: string
  label: string
  opens: Step
  area: Polygon
  reach: number
}

export interface PlacedRoom {
  room: Room
  at: Point
  floors: Polygon[]
  blocked: Polygon[]
  stations: PlacedStation[]
  /** Floor centre in world pixels (camera target). */
  center: Point
}

export interface Corridor {
  id: string
  roomId: string
  /** The lobby door that gates it. */
  door: Door
  doorArea: Polygon
  path: Point[]
  polys: Polygon[]
}

export interface HqMap {
  corridorWidth: number
  rooms: PlacedRoom[]
  corridors: Corridor[]
  lobby: PlacedRoom
}

function place(room: Room, at: Point): PlacedRoom {
  const floors = room.walkable.map((p) => translate(p as Polygon, at))
  return {
    room,
    at,
    floors,
    blocked: room.blocked.map((p) => translate(p as Polygon, at)),
    stations: room.stations.map((s) => ({
      key: `${room.id}/${s.id}`,
      label: s.label,
      opens: s.opens,
      area: translate(s.area as Polygon, at),
      reach: s.reach,
    })),
    center: centroid(floors[0]!),
  }
}

let cached: HqMap | null = null

export function getHqMap(): HqMap {
  if (cached) return cached
  const map = mapSchema.parse(mapJson)
  const rooms = map.rooms.map((r) => place(getRoom(r.id), r.at as Point))
  const lobby = rooms.find((r) => r.room.id === LOBBY_ID)
  if (!lobby) throw new Error('hq-map.json: the lobby must be placed')
  const corridors = map.corridors.map((c) => {
    const door = lobby.room.doors.find((d) => d.id === c.door)
    if (!door) throw new Error(`hq-map.json: corridor "${c.id}" uses unknown lobby door "${c.door}"`)
    const path = c.path as Point[]
    return {
      id: c.id,
      roomId: c.room,
      door,
      doorArea: translate(door.area as Polygon, lobby.at),
      path,
      polys: stripPolygons(path, map.corridorWidth),
    }
  })
  cached = { corridorWidth: map.corridorWidth, rooms, corridors, lobby }
  return cached
}
