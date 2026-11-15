/**
 * The whole HQ in one Phaser scene: every room image on one world canvas, the player, collision,
 * door portals (fade out, camera pan, fade in at the linked door), station glow/clicks, locked
 * rooms (dark + padlock) and their unlock animation, the room camera, and the F2 overlay.
 * Prompts, popups and menus are React (HQWorld).
 */
import Phaser from 'phaser'
import { getAsset } from '@/ui/assets'
import { reportLoading } from '@/ui/loadingStore'
import { playSound } from '@/ui/sound'
import {
  animKey,
  FOOT_Y,
  FRAME_RATE,
  FRAME_SIZE,
  FRAMES_PER_DIR,
  MOTIONS,
  SHEET_DIRS,
  SHEET_FILE,
  sheetDir,
  type Facing,
} from './character'
import {
  canStand,
  centroid,
  distanceToPolygon,
  pointInPolygon,
  type Point,
  type Polygon,
} from './geometry'
import { drawPadlock, popOutline, roomLight, tokenColor, type RoomLight } from './hqArt'
import {
  gatedRooms,
  getHqMap,
  type HqMap,
  type PlacedDoor,
  type PlacedRoom,
  type PlacedStation,
} from './hqMap'
import { PlayerActor } from './player/PlayerActor'
import type { Step } from './rooms/room'
import { addCutOutTexture } from './roomTexture'

/** Camera smoothing time constants: following inside a room, and the portal pan (~0.5 s). */
const CAMERA_TAU_MS = 200
const PAN_TAU_MS = 110
const PAN_MS = 500
const FADE_MS = 180
/** How much the camera follows the player inside a room (0 = room centre, 1 = player). */
const ROOM_FOLLOW = 0.35
/** Visible world size the zoom aims for: the current room fills most of the screen. */
const VIEW_W = 1270
const VIEW_H = 760
const UNLOCK_MS = 1000
const SAVE_EVERY_MS = 1000

export type Target =
  | { kind: 'station'; key: string; label: string; opens: Step }
  | { kind: 'locked'; key: string; label: string; roomId: string }

export interface HqCrew {
  /** Feet position in WORLD pixels. */
  at: Point
  /** Theme colour token for the tint, e.g. "role-science". */
  color: string
  facing: Facing
}

export interface SceneCallbacks {
  onTarget: (target: Target | null) => void
  onInteract: (target: Target) => void
  /** Top of the player's helmet in canvas CSS pixels (for the React prompt). */
  onPlayerScreen: (x: number, y: number) => void
  onPlayerMoved: (p: Point) => void
  /** True while a popup or menu is open: no movement, keyboard released for React. */
  isPaused: () => boolean
  /** Lock reason per gated room id (null/missing = open). */
  locks: () => Record<string, string | null>
  /** Room NOVA is pointing the player to (tutorial), or null for no marker. */
  marker?: () => string | null
}

type Keys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift',
  Phaser.Input.Keyboard.Key
>

export class HQScene extends Phaser.Scene {
  private readonly cb: () => SceneCallbacks
  private readonly spawn: Point
  private readonly map: HqMap
  private readonly walkable: Polygon[]
  private readonly blocked: Polygon[]
  private actor!: PlayerActor
  private player!: Phaser.GameObjects.Sprite
  private keys!: Keys
  private target: Target | null = null
  private paused = false
  /** Set while walking through a portal: input off, camera pans to this room. */
  private transit: PlacedRoom | null = null
  /** Door the player is standing in (portals trigger on entering, not while standing). */
  private inDoor: string | null = null
  private room: PlacedRoom
  private locked = new Map<string, boolean>()
  private roomLights = new Map<string, RoomLight>()
  private padlocks = new Map<string, Phaser.GameObjects.Graphics>()
  private glow: Phaser.GameObjects.Graphics | null = null
  private debug: Phaser.GameObjects.Graphics | null = null
  private marker: Phaser.GameObjects.Graphics | null = null
  private cam = { x: 0, y: 0 }
  private saved = { at: 0, x: 0, y: 0 }

  /** Crew standing in the HQ (the debrief in the Briefing room); idle, no collision. */
  private readonly crew: readonly HqCrew[]

  constructor(callbacks: () => SceneCallbacks, spawn: Point | null, crew: readonly HqCrew[] = []) {
    super('hq')
    this.cb = callbacks
    this.crew = crew
    this.map = getHqMap()
    this.walkable = this.map.rooms.flatMap((r) => r.floors)
    this.blocked = this.map.rooms.flatMap((r) => r.blocked)
    const valid = spawn && canStand(spawn, this.walkable, this.blocked)
    this.spawn = valid ? spawn : this.map.lobby.center
    this.room = this.roomAt(this.spawn) ?? this.map.lobby
  }

  preload() {
    reportLoading(0)
    this.load.on('progress', (p: number) => reportLoading(p))
    for (const { room } of this.map.rooms) {
      this.load.image(`room-${room.id}`, getAsset(room.image.kind, room.image.id, room.image.ext))
    }
    for (const motion of MOTIONS) {
      const url = getAsset('sprites', `maincharacter/${SHEET_FILE[motion]}`, 'png')
      this.load.spritesheet(motion, url, { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE })
    }
    PlayerActor.preload(this)
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn(`[world] could not load "${file.src}"`),
    )
  }

  create() {
    reportLoading(null)
    for (const placed of this.map.rooms) {
      const key = `room-${placed.room.id}`
      if (!this.textures.exists(key)) continue
      addCutOutTexture(this, key, `${key}-cut`)
      const image = this.add
        .image(placed.at[0], placed.at[1], `${key}-cut`)
        .setOrigin(0)
        .setDepth(1)
      this.roomLights.set(placed.room.id, roomLight(image))
    }
    this.applyLocks(false)

    this.createAnims()
    const [sx, sy] = this.spawn
    // The player is drawn from the player pack (cabin suit: helmet off inside the HQ).
    this.actor = new PlayerActor(this, sx, sy)
    this.actor.setVariant('cabin')
    this.player = this.actor.sprite.setDepth(5 + sy / 10000)
    for (const c of this.crew) {
      const { dir, flip } = sheetDir(c.facing)
      const npc = this.add
        .sprite(c.at[0], c.at[1], 'idle')
        .setOrigin(0.5, FOOT_Y / FRAME_SIZE)
        .setScale(this.map.lobby.room.playerScale)
        .setDepth(5 + c.at[1] / 10000)
        .setTint(tokenColor(c.color))
        .setFlipX(flip)
      if (this.anims.exists(animKey('idle', dir))) npc.play(animKey('idle', dir))
    }
    this.saved = { at: 0, x: sx, y: sy }
    this.inDoor = this.doorAt(this.spawn)?.key ?? null

    const kb = this.input.keyboard!
    const K = Phaser.Input.Keyboard.KeyCodes
    this.keys = kb.addKeys({
      up: K.UP,
      down: K.DOWN,
      left: K.LEFT,
      right: K.RIGHT,
      w: K.W,
      a: K.A,
      s: K.S,
      d: K.D,
      shift: K.SHIFT,
    }) as Keys
    kb.on('keydown-E', () => this.onUse())
    kb.addCapture(K.F2)
    kb.on('keydown-F2', () => this.toggleDebug())
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.input.setDefaultCursor(this.stationAt(p) ? 'pointer' : 'default')
    })

    this.scale.on('resize', this.fit, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.fit, this))
    this.fit()
    this.cam = { ...this.cameraTarget() }
    this.cameras.main.centerOn(this.cam.x, this.cam.y)
  }

  override update(time: number, deltaMs: number) {
    this.syncPaused()
    this.applyLocks(true)
    const k = this.keys
    const dx = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown)
    const dy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown)
    const input = !this.paused && !this.transit ? { dx, dy, running: k.shift.isDown } : null
    this.actor.update(
      deltaMs,
      input,
      (mx, my) => this.move(mx, my),
      () => playSound('footstep'),
    )
    this.player.setDepth(5 + this.player.y / 10000)
    if (!this.transit) {
      this.room = this.roomAt([this.player.x, this.player.y]) ?? this.room
      this.checkDoor()
    }
    this.updateTarget()
    this.updateCamera(deltaMs)
    this.updateMarker(time)
    this.reportPosition(time)
  }

  // ---- doors -------------------------------------------------------------------------------

  private doorAt(p: Point): PlacedDoor | undefined {
    for (const r of this.map.rooms)
      for (const d of r.doors) if (d.target && pointInPolygon(p, d.area)) return d
    return undefined
  }

  /** Locked if it is a gated lobby door whose room is still locked. */
  private isDoorLocked(d: PlacedDoor): boolean {
    return d.roomId === this.map.lobby.room.id && !!this.locked.get(d.door.to)
  }

  /** Walking into an unlocked door goes through it. */
  private checkDoor() {
    const door = this.doorAt([this.player.x, this.player.y])
    const entered = door && door.key !== this.inDoor
    this.inDoor = door?.key ?? null
    if (entered && !this.paused && !this.isDoorLocked(door)) this.portal(door)
  }

  private onUse() {
    if (this.transit) return
    if (this.target?.kind === 'station') {
      this.popStation(this.target.key)
      this.cb().onInteract(this.target)
      return
    }
    const door = this.doorAt([this.player.x, this.player.y])
    if (door && !this.isDoorLocked(door)) this.portal(door)
  }

  /** Fade out at the door, pan the camera to the linked room, fade in at its door. */
  private portal(from: PlacedDoor) {
    const to = from.target ? this.map.doors.get(from.target) : undefined
    const dest = to && this.map.rooms.find((r) => r.room.id === to.roomId)
    if (!to || !dest) return
    this.transit = dest
    playSound('door')
    this.tweens.add({ targets: this.player, alpha: 0, duration: FADE_MS })
    this.time.delayedCall(PAN_MS, () => {
      this.player.setPosition(to.arrival[0], to.arrival[1])
      this.room = dest
      this.inDoor = null
      this.tweens.add({
        targets: this.player,
        alpha: 1,
        duration: FADE_MS,
        onComplete: () => {
          this.transit = null
          this.cb().onPlayerMoved(to.arrival)
        },
      })
    })
  }

  // ---- locks ------------------------------------------------------------------------------

  /** Syncs locked rooms with React's lock state; animates rooms that just unlocked. */
  private applyLocks(animate: boolean) {
    const locks = this.cb().locks()
    for (const { roomId } of gatedRooms(this.map)) {
      const isLocked = !!locks[roomId]
      if (this.locked.get(roomId) === isLocked) continue
      this.locked.set(roomId, isLocked)
      if (isLocked) this.setLocked(roomId)
      else if (animate) this.animateUnlock(roomId)
      else this.roomLights.get(roomId)?.set(1)
    }
  }

  private setLocked(roomId: string) {
    this.roomLights.get(roomId)?.set(0)
    const room = this.map.rooms.find((r) => r.room.id === roomId)
    if (room && !this.padlocks.has(roomId))
      this.padlocks.set(roomId, drawPadlock(this, [room.center[0], room.center[1] - 40]))
  }

  /** Lights come on: the room brightens over ~1 s and its padlock fades away. */
  private animateUnlock(roomId: string) {
    const light = this.roomLights.get(roomId)
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: UNLOCK_MS,
      onUpdate: (tw) => light?.set(tw.getValue() ?? 1),
    })
    const padlock = this.padlocks.get(roomId)
    this.padlocks.delete(roomId)
    if (padlock)
      this.tweens.add({
        targets: padlock,
        alpha: 0,
        duration: UNLOCK_MS / 2,
        onComplete: () => padlock.destroy(),
      })
    playSound('unlock')
  }

  // ---- movement, targets, camera ------------------------------------------------------------

  private syncPaused() {
    const paused = this.cb().isPaused()
    if (paused === this.paused) return
    this.paused = paused
    const kb = this.input.keyboard!
    kb.enabled = !paused
    if (paused) kb.disableGlobalCapture()
    else kb.enableGlobalCapture()
    kb.resetKeys()
  }

  /** Moves if the new spot is standable; otherwise slides along one axis. */
  private move(mx: number, my: number) {
    const { x, y } = this.player
    const tries: Point[] = [
      [x + mx, y + my],
      [x + mx, y],
      [x, y + my],
    ]
    const next = tries.find((p) => canStand(p, this.walkable, this.blocked))
    if (next) this.player.setPosition(next[0], next[1])
  }

  private roomAt(p: Point): PlacedRoom | undefined {
    return this.map.rooms.find((r) => r.floors.some((f) => pointInPolygon(p, f)))
  }

  private openStations(): PlacedStation[] {
    return this.map.rooms.filter((r) => !this.locked.get(r.room.id)).flatMap((r) => r.stations)
  }

  /** A locked lobby door the player stands at, else the nearest station within reach. */
  private updateTarget() {
    const p: Point = [this.player.x, this.player.y]
    let target: Target | null = null
    const door = this.transit ? undefined : this.doorAt(p)
    if (door && this.isDoorLocked(door)) {
      target = { kind: 'locked', key: door.key, label: door.door.label, roomId: door.door.to }
    } else if (!this.transit) {
      let best = Infinity
      for (const s of this.openStations()) {
        const d = distanceToPolygon(p, s.area)
        if (d <= s.reach && d < best) {
          best = d
          target = { kind: 'station', key: s.key, label: s.label, opens: s.opens }
        }
      }
    }
    if (target?.key === this.target?.key) return
    this.target = target
    this.drawGlow()
    this.cb().onTarget(target)
  }

  /** NOVA's tutorial arrow: over the room's lobby door, or its station once inside the room. */
  private updateMarker(time: number) {
    const roomId = this.cb().marker?.() ?? null
    const target = roomId ? this.markerPoint(roomId) : null
    if (!target) {
      this.marker?.setVisible(false)
      return
    }
    if (!this.marker) {
      const g = this.add.graphics().setDepth(9)
      g.fillStyle(tokenColor('alert'), 1)
      g.fillTriangle(-12, -18, 12, -18, 0, 0)
      g.fillStyle(tokenColor('bg'), 1).fillRect(-3, -15, 6, 6)
      this.marker = g
    }
    const bob = Math.sin(time / 260) * 6
    this.marker.setVisible(true).setPosition(target[0], target[1] - 40 + bob)
  }

  private markerPoint(roomId: string): Point | null {
    const room = this.map.rooms.find((r) => r.room.id === roomId)
    if (!room) return null
    if (this.room === room) {
      const station = room.stations[0]
      return station ? centroid(station.area) : room.center
    }
    const door = this.map.lobby.doors.find((d) => d.door.to === roomId)
    return door ? centroid(door.area) : null
  }

  private popStation(key: string) {
    const station = this.openStations().find((st) => st.key === key)
    if (station) popOutline(this, this.glow, centroid(station.area))
  }

  private drawGlow() {
    this.glow?.destroy()
    this.glow = null
    const key = this.target?.kind === 'station' ? this.target.key : null
    const station = key ? this.openStations().find((s) => s.key === key) : undefined
    if (!station) return
    const color = tokenColor('accent')
    const pts = station.area.map(([x, y]) => new Phaser.Math.Vector2(x, y))
    const g = this.add.graphics().setDepth(4)
    g.fillStyle(color, 0.08).fillPoints(pts, true)
    g.lineStyle(6, color, 0.25).strokePoints(pts, true)
    g.lineStyle(2, color, 0.9).strokePoints(pts, true)
    this.tweens.add({
      targets: g,
      alpha: { from: 0.35, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
    })
    this.glow = g
  }

  /** Mostly the current room's centre, leaning towards the player; the portal target while panning. */
  private cameraTarget(): { x: number; y: number } {
    const room = this.transit ?? this.room
    const p = this.transit ? room.center : ([this.player.x, this.player.y] as Point)
    return {
      x: room.center[0] + (p[0] - room.center[0]) * ROOM_FOLLOW,
      y: room.center[1] - 40 + (p[1] - room.center[1]) * ROOM_FOLLOW,
    }
  }

  private updateCamera(deltaMs: number) {
    const t = this.cameraTarget()
    const k = 1 - Math.exp(-deltaMs / (this.transit ? PAN_TAU_MS : CAMERA_TAU_MS))
    this.cam.x += (t.x - this.cam.x) * k
    this.cam.y += (t.y - this.cam.y) * k
    const cam = this.cameras.main
    cam.centerOn(this.cam.x, this.cam.y)
    const headY = this.actor.headY()
    this.cb().onPlayerScreen(
      (this.player.x - cam.worldView.x) * cam.zoom,
      (headY - cam.worldView.y) * cam.zoom,
    )
  }

  private reportPosition(time: number) {
    if (this.transit || time - this.saved.at < SAVE_EVERY_MS) return
    const { x, y } = this.player
    this.saved.at = time
    if (Math.hypot(x - this.saved.x, y - this.saved.y) < 2) return
    this.saved = { at: time, x, y }
    this.cb().onPlayerMoved([x, y])
  }

  private stationAt(p: Phaser.Input.Pointer) {
    const w = this.cameras.main.getWorldPoint(p.x, p.y)
    return this.openStations().find((s) => pointInPolygon([w.x, w.y], s.area))
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (this.debug) {
      const w = this.cameras.main.getWorldPoint(p.x, p.y)
      console.log(`[world] world px: [${Math.round(w.x)}, ${Math.round(w.y)}]`)
      return
    }
    if (this.paused || this.transit) return
    const s = this.stationAt(p)
    if (s) {
      this.popStation(s.key)
      this.cb().onInteract({ kind: 'station', key: s.key, label: s.label, opens: s.opens })
    }
  }

  private createAnims() {
    for (const motion of MOTIONS) {
      SHEET_DIRS.forEach((dir, i) => {
        const key = animKey(motion, dir)
        if (this.anims.exists(key)) return
        const start = i * FRAMES_PER_DIR
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(motion, {
            start,
            end: start + FRAMES_PER_DIR - 1,
          }),
          frameRate: FRAME_RATE[motion],
          repeat: -1,
        })
      })
    }
  }

  private fit() {
    const { width, height } = this.scale.gameSize
    const cam = this.cameras.main
    cam.setSize(width, height)
    cam.setZoom(Math.min(width / VIEW_W, height / VIEW_H))
  }

  /** All polygons in world coordinates; clicks log world coordinates. */
  private toggleDebug() {
    if (this.debug) {
      this.debug.destroy()
      this.debug = null
      return
    }
    const g = this.add.graphics().setDepth(10)
    const draw = (poly: Polygon, color: number) => {
      const pts = poly.map(([x, y]) => new Phaser.Math.Vector2(x, y))
      g.fillStyle(color, 0.22).fillPoints(pts, true)
      g.lineStyle(1, color, 1).strokePoints(pts, true)
    }
    for (const r of this.map.rooms) {
      r.floors.forEach((f) => draw(f, tokenColor('success')))
      r.blocked.forEach((b) => draw(b, tokenColor('danger')))
      r.stations.forEach((s) => draw(s.area, tokenColor('accent')))
      r.doors.forEach((d) => draw(d.area, tokenColor(d.door.color)))
    }
    this.debug = g
    console.log('[world] F2 overlay on: click to log WORLD pixel coordinates')
  }
}
