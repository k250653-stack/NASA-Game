/**
 * The HQ in one Phaser scene over ONE map picture (rooms/hq-map.json): the player walks through
 * open doorways between rooms (no portals), collides with walls and furniture, and is drawn
 * behind tall furniture by foot Y. Locked rooms are dimmed with a padlock and their doorway is
 * closed; unlocking fades the lights on. Stations glow and open React popups. F2 shows every
 * polygon in world coordinates. Prompts, popups and menus are React (HQWorld).
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
import { drawPadlock, popOutline, tokenColor } from './hqArt'
import {
  gatedRooms,
  getHqMap,
  type HqMap,
  type HqRoom,
  type HqStation,
  type StationOpens,
} from './hqMap'
import { PlayerActor } from './player/PlayerActor'

/** Camera smoothing time constant (re-centres on a new room in ~0.6 s). */
const CAMERA_TAU_MS = 200
/** How much the camera follows the player inside a room (0 = room centre, 1 = player). */
const ROOM_FOLLOW = 0.55
/** World area the zoom aims to show; the zoom is a whole number when the screen allows. */
const VIEW_W = 600
const VIEW_H = 340
const UNLOCK_MS = 1000
const SAVE_EVERY_MS = 1000
/** Locked rooms keep 25% of their light. */
const LOCKED_DIM = 0.75
/** How close (px) the player must be to a locked doorway to see why it is closed. */
const LOCK_PROMPT_RANGE = 30
const DEPTH_MAP = 1
const DEPTH_DIM = 2
const DEPTH_GLOW = 4
const DEPTH_ACTORS = 5
const DEPTH_MARKER = 9
const DEPTH_DEBUG = 10

export type Target =
  | { kind: 'station'; key: string; label: string; opens: StationOpens }
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
  /** Top of the player's head in canvas CSS pixels (for the React prompt). */
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

/** Depth for anything standing on the floor: further down the screen = in front. */
const footDepth = (y: number) => DEPTH_ACTORS + y / 10000

export class HQScene extends Phaser.Scene {
  private readonly cb: () => SceneCallbacks
  private readonly map: HqMap
  private readonly spawn: Point
  private readonly crew: readonly HqCrew[]
  private actor!: PlayerActor
  private player!: Phaser.GameObjects.Sprite
  private keys!: Keys
  private target: Target | null = null
  private paused = false
  private room: HqRoom | null = null
  private walkable: Polygon[] = []
  private locked = new Map<string, boolean>()
  private dimmers = new Map<string, Phaser.GameObjects.Graphics>()
  private padlocks = new Map<string, Phaser.GameObjects.Graphics>()
  private glow: Phaser.GameObjects.Graphics | null = null
  private debug: Phaser.GameObjects.Graphics | null = null
  private marker: Phaser.GameObjects.Graphics | null = null
  private cam = { x: 0, y: 0 }
  private saved = { at: 0, x: 0, y: 0 }

  constructor(callbacks: () => SceneCallbacks, spawn: Point | null, crew: readonly HqCrew[] = []) {
    super('hq')
    this.cb = callbacks
    this.crew = crew
    this.map = getHqMap()
    this.spawn = spawn ?? this.map.spawn
  }

  preload() {
    reportLoading(0)
    this.load.on('progress', (p: number) => reportLoading(p))
    const { image } = this.map
    this.load.image('hq-map', getAsset(image.kind, image.id, image.ext))
    // The crew standing at the debrief table still use the tinted crew sprite sheets.
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
    if (this.textures.exists('hq-map')) {
      this.add.image(0, 0, 'hq-map').setOrigin(0).setDepth(DEPTH_MAP)
      this.addOccluders()
    }
    this.applyLocks(false)
    this.createAnims()

    const start = canStand(this.spawn, this.walkable, this.map.blocked)
      ? this.spawn
      : this.map.spawn
    this.actor = new PlayerActor(this, start[0], start[1])
    this.actor.setVariant('cabin')
    this.player = this.actor.sprite.setDepth(footDepth(start[1]))
    this.room = this.roomAt(start) ?? null
    this.saved = { at: 0, x: start[0], y: start[1] }
    for (const c of this.crew) this.addCrew(c)

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

    const cam = this.cameras.main
    cam.setBounds(0, 0, this.map.size[0], this.map.size[1])
    this.scale.on('resize', this.fit, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.fit, this))
    this.fit()
    this.cam = this.cameraTarget()
    cam.centerOn(this.cam.x, this.cam.y)
  }

  override update(time: number, deltaMs: number) {
    this.syncPaused()
    this.applyLocks(true)
    const k = this.keys
    const dx = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown)
    const dy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown)
    const input = this.paused ? null : { dx, dy, running: k.shift.isDown }
    this.actor.update(
      deltaMs,
      input,
      (mx, my) => this.move(mx, my),
      () => playSound('footstep'),
    )
    this.player.setDepth(footDepth(this.player.y))
    this.room = this.roomAt([this.player.x, this.player.y]) ?? this.room
    this.updateTarget()
    this.updateCamera(deltaMs)
    this.updateMarker(time)
    this.reportPosition(time)
  }

  // ---- map pieces ---------------------------------------------------------------------------

  /** Copies of tall furniture, cut to their silhouette, sorted by foot Y like the player. */
  private addOccluders() {
    for (const o of this.map.occluders) {
      const shape = this.make.graphics({}, false)
      shape
        .fillStyle(0xffffff, 1)
        .fillPoints(
          o.shape.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
          true,
        )
      this.add
        .image(0, 0, 'hq-map')
        .setOrigin(0)
        .setDepth(footDepth(o.baseY))
        .setMask(shape.createGeometryMask())
    }
  }

  private addCrew(c: HqCrew) {
    const { dir, flip } = sheetDir(c.facing)
    const npc = this.add
      .sprite(c.at[0], c.at[1], 'idle')
      .setOrigin(0.5, FOOT_Y / FRAME_SIZE)
      .setScale(0.7)
      .setDepth(footDepth(c.at[1]))
      .setTint(tokenColor(c.color))
      .setFlipX(flip)
    if (this.anims.exists(animKey('idle', dir))) npc.play(animKey('idle', dir))
  }

  private createAnims() {
    for (const motion of MOTIONS) {
      SHEET_DIRS.forEach((dir, i) => {
        const key = animKey(motion, dir)
        if (this.anims.exists(key) || !this.textures.exists(motion)) return
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

  // ---- locks --------------------------------------------------------------------------------

  /** Syncs locked rooms with React's lock state; animates rooms that just unlocked. */
  private applyLocks(animate: boolean) {
    const locks = this.cb().locks()
    let changed = !animate
    for (const { roomId } of gatedRooms(this.map)) {
      const isLocked = !!locks[roomId]
      if (this.locked.get(roomId) === isLocked) continue
      changed = true
      this.locked.set(roomId, isLocked)
      if (isLocked) this.setLocked(roomId)
      else this.setUnlocked(roomId, animate)
    }
    if (!changed) return
    // Floors of every room plus the outside path; a locked room's doorway is closed.
    const open = this.map.doorways.filter((d) => !this.locked.get(d.room))
    this.walkable = [
      ...this.map.rooms.map((r) => r.floor),
      ...this.map.outdoor,
      ...open.map((d) => d.area),
    ]
  }

  private setLocked(roomId: string) {
    const room = this.map.rooms.find((r) => r.id === roomId)
    if (!room) return
    let dim = this.dimmers.get(roomId)
    if (!dim) {
      dim = this.add.graphics().setDepth(DEPTH_DIM)
      dim
        .fillStyle(tokenColor('bg'), 1)
        .fillPoints(
          room.floor.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
          true,
        )
      this.dimmers.set(roomId, dim)
    }
    dim.setAlpha(LOCKED_DIM)
    if (!this.padlocks.has(roomId))
      this.padlocks.set(roomId, drawPadlock(this, [room.center[0], room.center[1] - 10]))
  }

  /** Lights come on: the dimmer fades out over ~1 s and the padlock goes. */
  private setUnlocked(roomId: string, animate: boolean) {
    const dim = this.dimmers.get(roomId)
    const padlock = this.padlocks.get(roomId)
    this.padlocks.delete(roomId)
    if (!animate) {
      dim?.setAlpha(0)
      padlock?.destroy()
      return
    }
    if (dim) this.tweens.add({ targets: dim, alpha: 0, duration: UNLOCK_MS })
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
    const next = tries.find((p) => canStand(p, this.walkable, this.map.blocked))
    if (next) this.player.setPosition(next[0], next[1])
  }

  private roomAt(p: Point): HqRoom | undefined {
    return this.map.rooms.find((r) => pointInPolygon(p, r.floor))
  }

  private openStations(): HqStation[] {
    return this.map.stations.filter((s) => !this.locked.get(s.room))
  }

  /** A locked doorway the player is next to, else the nearest station within reach. */
  private updateTarget() {
    const p: Point = [this.player.x, this.player.y]
    let target: Target | null = null
    const door = this.map.doorways.find(
      (d) => this.locked.get(d.room) && distanceToPolygon(p, d.area) <= LOCK_PROMPT_RANGE,
    )
    if (door) {
      target = { kind: 'locked', key: door.id, label: door.label, roomId: door.room }
    } else {
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

  private onUse() {
    if (this.target?.kind !== 'station') return
    this.popStation(this.target.key)
    this.cb().onInteract(this.target)
  }

  /** NOVA's tutorial arrow: over the doorway into the room, or its station once inside. */
  private updateMarker(time: number) {
    const roomId = this.cb().marker?.() ?? null
    const at = roomId ? this.markerPoint(roomId) : null
    if (!at) {
      this.marker?.setVisible(false)
      return
    }
    if (!this.marker) {
      const g = this.add.graphics().setDepth(DEPTH_MARKER)
      g.fillStyle(tokenColor('alert'), 1)
      g.fillTriangle(-12, -18, 12, -18, 0, 0)
      g.fillStyle(tokenColor('bg'), 1).fillRect(-3, -15, 6, 6)
      this.marker = g
    }
    const bob = Math.sin(time / 260) * 6
    this.marker.setVisible(true).setPosition(at[0], at[1] - 40 + bob)
  }

  private markerPoint(roomId: string): Point | null {
    if (this.room?.id === roomId) {
      const station = this.map.stations.find((s) => s.room === roomId)
      return station ? centroid(station.area) : this.room.center
    }
    const door = this.map.doorways.find((d) => d.room === roomId)
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
    const g = this.add.graphics().setDepth(DEPTH_GLOW)
    g.fillStyle(color, 0.08).fillPoints(pts, true)
    g.lineStyle(4, color, 0.25).strokePoints(pts, true)
    g.lineStyle(1, color, 0.9).strokePoints(pts, true)
    this.tweens.add({
      targets: g,
      alpha: { from: 0.35, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
    })
    this.glow = g
  }

  /** In a room: its centre, leaning towards the player. Outside (the path): the player. */
  private cameraTarget(): { x: number; y: number } {
    const p: Point = this.player ? [this.player.x, this.player.y] : this.spawn
    const room = this.room
    if (!room) return { x: p[0], y: p[1] - 40 }
    return {
      x: room.center[0] + (p[0] - room.center[0]) * ROOM_FOLLOW,
      y: room.center[1] - 30 + (p[1] - room.center[1]) * ROOM_FOLLOW,
    }
  }

  private updateCamera(deltaMs: number) {
    const t = this.cameraTarget()
    const k = 1 - Math.exp(-deltaMs / CAMERA_TAU_MS)
    this.cam.x += (t.x - this.cam.x) * k
    this.cam.y += (t.y - this.cam.y) * k
    const cam = this.cameras.main
    cam.centerOn(this.cam.x, this.cam.y)
    this.cb().onPlayerScreen(
      (this.player.x - cam.worldView.x) * cam.zoom,
      (this.actor.headY() - cam.worldView.y) * cam.zoom,
    )
  }

  private reportPosition(time: number) {
    if (time - this.saved.at < SAVE_EVERY_MS) return
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
    if (this.paused) return
    const s = this.stationAt(p)
    if (s) {
      this.popStation(s.key)
      this.cb().onInteract({ kind: 'station', key: s.key, label: s.label, opens: s.opens })
    }
  }

  /** A whole-number zoom when the screen allows it, so the map's pixels stay even. */
  private fit() {
    const { width, height } = this.scale.gameSize
    const cam = this.cameras.main
    cam.setSize(width, height)
    const ideal = Math.min(width / VIEW_W, height / VIEW_H)
    cam.setZoom(ideal >= 1 ? Math.floor(ideal) : ideal)
  }

  /** All polygons in world coordinates; clicks log world coordinates. */
  private toggleDebug() {
    if (this.debug) {
      this.debug.destroy()
      this.debug = null
      return
    }
    const g = this.add.graphics().setDepth(DEPTH_DEBUG)
    const draw = (poly: Polygon, color: number) => {
      const pts = poly.map(([x, y]) => new Phaser.Math.Vector2(x, y))
      g.fillStyle(color, 0.22).fillPoints(pts, true)
      g.lineStyle(1, color, 1).strokePoints(pts, true)
    }
    this.map.rooms.forEach((r) => draw(r.floor, tokenColor('success')))
    this.map.outdoor.forEach((o) => draw(o, tokenColor('success')))
    this.map.blocked.forEach((b) => draw(b, tokenColor('danger')))
    this.map.occluders.forEach((o) => draw(o.shape, tokenColor('role-science')))
    this.map.stations.forEach((s) => draw(s.area, tokenColor('accent')))
    this.map.doorways.forEach((d) => draw(d.area, tokenColor(d.color)))
    this.debug = g
    console.log('[world] F2 overlay on: click to log WORLD pixel coordinates (hq-map.json)')
  }
}
