/**
 * The whole HQ in one Phaser scene: every room image on one world canvas, the corridors between
 * them, the player, collision against the combined walkable area, station glow/clicks, locked
 * rooms (dark + padlock) and their unlock animation, the room-to-room camera, and the F2 overlay.
 * Prompts, popups and menus are React (HQWorld).
 */
import Phaser from 'phaser'
import { getAsset } from '@/ui/assets'
import { playSound } from '@/ui/sound'
import { animKey, facingFrom, FOOT_Y, FRAME_RATE, FRAME_SIZE, FRAMES_PER_DIR, HEAD_Y, MOTIONS, SHEET_DIRS, SHEET_FILE, sheetDir, type Facing, type Motion } from './character'
import { canStand, distanceToPolygon, pointInPolygon, type Point, type Polygon } from './geometry'
import { drawCorridor, drawPadlock, roomLight, tokenColor, type CorridorArt, type RoomLight } from './hqArt'
import { getHqMap, type Corridor, type HqMap, type PlacedRoom, type PlacedStation } from './hqMap'
import type { Step } from './rooms/room'
import { addCutOutTexture } from './roomTexture'

const WALK_SPEED = 90
const RUN_SPEED = 170
/** Camera smoothing time constant: settles on a new room in ~0.6 s. */
const CAMERA_TAU_MS = 200
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
}

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift', Phaser.Input.Keyboard.Key>

export class HQScene extends Phaser.Scene {
  private readonly cb: () => SceneCallbacks
  private readonly spawn: Point
  private map!: HqMap
  private player!: Phaser.GameObjects.Sprite
  private keys!: Keys
  private facing: Facing = 'S'
  private target: Target | null = null
  private paused = false
  private locked = new Map<string, boolean>()
  private walkable: Polygon[] = []
  private blocked: Polygon[] = []
  private roomLights = new Map<string, RoomLight>()
  private corridorArt = new Map<string, CorridorArt>()
  private padlocks = new Map<string, Phaser.GameObjects.Graphics>()
  private glow: Phaser.GameObjects.Graphics | null = null
  private debug: Phaser.GameObjects.Graphics | null = null
  private cam = { x: 0, y: 0 }
  private saved = { at: 0, x: 0, y: 0 }

  constructor(callbacks: () => SceneCallbacks, spawn: Point | null) {
    super('hq')
    this.cb = callbacks
    this.map = getHqMap()
    this.spawn = spawn ?? this.map.lobby.center
  }

  preload() {
    for (const { room } of this.map.rooms) {
      this.load.image(`room-${room.id}`, getAsset(room.image.kind, room.image.id, room.image.ext))
    }
    for (const motion of MOTIONS) {
      const url = getAsset('sprites', `maincharacter/${SHEET_FILE[motion]}`, 'png')
      this.load.spritesheet(motion, url, { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE })
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn(`[world] could not load "${file.src}"`))
  }

  create() {
    for (const c of this.map.corridors) this.corridorArt.set(c.id, drawCorridor(this, c, this.map.corridorWidth))
    for (const placed of this.map.rooms) {
      const key = `room-${placed.room.id}`
      if (!this.textures.exists(key)) continue
      addCutOutTexture(this, key, `${key}-cut`)
      const image = this.add.image(placed.at[0], placed.at[1], `${key}-cut`).setOrigin(0).setDepth(1)
      this.roomLights.set(placed.room.id, roomLight(image))
    }
    this.blocked = this.map.rooms.flatMap((r) => r.blocked)
    this.applyLocks(false)

    this.createAnims()
    const spawn = canStand(this.spawn, this.walkable, this.blocked) ? this.spawn : this.map.lobby.center
    this.player = this.add
      .sprite(spawn[0], spawn[1], 'idle')
      .setOrigin(0.5, FOOT_Y / FRAME_SIZE)
      .setScale(this.map.lobby.room.playerScale)
      .setDepth(5)
    this.playAnim('idle')
    this.saved = { at: 0, x: spawn[0], y: spawn[1] }

    const kb = this.input.keyboard!
    const K = Phaser.Input.Keyboard.KeyCodes
    this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, shift: K.SHIFT }) as Keys
    kb.on('keydown-E', () => {
      if (this.target?.kind === 'station') this.cb().onInteract(this.target)
    })
    kb.addCapture(K.F2)
    kb.on('keydown-F2', () => this.toggleDebug())
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.input.setDefaultCursor(this.stationAt(p) ? 'pointer' : 'default')
    })

    this.scale.on('resize', this.fit, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.fit, this))
    this.fit()
    this.cam = { x: spawn[0], y: spawn[1] }
    this.cameras.main.centerOn(spawn[0], spawn[1])
  }

  override update(time: number, deltaMs: number) {
    this.syncPaused()
    this.applyLocks(true)
    const k = this.keys
    const dx = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown)
    const dy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown)
    if (!this.paused && (dx || dy)) {
      const running = k.shift.isDown
      const step = ((running ? RUN_SPEED : WALK_SPEED) * deltaMs) / 1000 / Math.hypot(dx, dy)
      this.move(dx * step, dy * step)
      this.facing = facingFrom(dx, dy)
      this.playAnim(running ? 'run' : 'walk')
    } else {
      this.playAnim('idle')
    }
    this.updateTarget()
    this.updateCamera(deltaMs)
    this.reportPosition(time)
  }

  /** Recomputes the walkable area from the lock state; animates rooms that just unlocked. */
  private applyLocks(animate: boolean) {
    const locks = this.cb().locks()
    let changed = !animate
    for (const c of this.map.corridors) {
      const isLocked = !!locks[c.roomId]
      if (this.locked.get(c.roomId) === isLocked) continue
      changed = true
      this.locked.set(c.roomId, isLocked)
      if (isLocked) this.setLocked(c)
      else if (animate) this.animateUnlock(c)
      else this.setUnlocked(c)
    }
    if (!changed) return
    const open = this.map.corridors.filter((c) => !this.locked.get(c.roomId))
    const openRooms = this.map.rooms.filter((r) => r === this.map.lobby || open.some((c) => c.roomId === r.room.id))
    this.walkable = [...openRooms.flatMap((r) => r.floors), ...open.flatMap((c) => c.polys)]
  }

  private setLocked(c: Corridor) {
    this.roomLights.get(c.roomId)?.set(0)
    const art = this.corridorArt.get(c.id)
    art?.lights.forEach((l) => l.setFillStyle(art.offColor))
    const room = this.roomById(c.roomId)
    if (room && !this.padlocks.has(c.roomId)) this.padlocks.set(c.roomId, drawPadlock(this, [room.center[0], room.center[1] - 40]))
  }

  private setUnlocked(c: Corridor) {
    this.roomLights.get(c.roomId)?.set(1)
    const art = this.corridorArt.get(c.id)
    art?.lights.forEach((l) => l.setFillStyle(art.color))
    this.padlocks.get(c.roomId)?.destroy()
    this.padlocks.delete(c.roomId)
  }

  /** Lights come on: the room brightens over ~1 s and the corridor lights switch on in order. */
  private animateUnlock(c: Corridor) {
    const light = this.roomLights.get(c.roomId)
    this.tweens.addCounter({ from: 0, to: 1, duration: UNLOCK_MS, onUpdate: (tw) => light?.set(tw.getValue() ?? 1) })
    const padlock = this.padlocks.get(c.roomId)
    this.padlocks.delete(c.roomId)
    if (padlock) this.tweens.add({ targets: padlock, alpha: 0, duration: UNLOCK_MS / 2, onComplete: () => padlock.destroy() })
    const art = this.corridorArt.get(c.id)
    art?.lights.forEach((l, i) => {
      this.time.delayedCall((i / art.lights.length) * UNLOCK_MS, () => {
        l.setFillStyle(art.color)
        this.tweens.add({ targets: l, scale: { from: 2.2, to: 1 }, duration: 220 })
      })
    })
    playSound('unlock')
  }

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
    const tries: Point[] = [[x + mx, y + my], [x + mx, y], [x, y + my]]
    const next = tries.find((p) => canStand(p, this.walkable, this.blocked))
    if (next) this.player.setPosition(next[0], next[1])
  }

  private openStations(): PlacedStation[] {
    return this.map.rooms.filter((r) => !this.locked.get(r.room.id)).flatMap((r) => r.stations)
  }

  /** A locked lobby door the player stands at, else the nearest station within reach. */
  private updateTarget() {
    const p: Point = [this.player.x, this.player.y]
    let target: Target | null = null
    const door = this.map.corridors.find((c) => this.locked.get(c.roomId) && pointInPolygon(p, c.doorArea))
    if (door) target = { kind: 'locked', key: door.id, label: door.door.label, roomId: door.roomId }
    else {
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
    this.tweens.add({ targets: g, alpha: { from: 0.35, to: 1 }, duration: 650, yoyo: true, repeat: -1 })
    this.glow = g
  }

  /** Inside a room: mostly its centre (pans between rooms). In a corridor: the player. */
  private updateCamera(deltaMs: number) {
    const p: Point = [this.player.x, this.player.y]
    const room = this.map.rooms.find((r) => r.floors.some((f) => pointInPolygon(p, f)))
    const tx = room ? room.center[0] + (p[0] - room.center[0]) * ROOM_FOLLOW : p[0]
    const ty = room ? room.center[1] - 40 + (p[1] - room.center[1]) * ROOM_FOLLOW : p[1]
    const k = 1 - Math.exp(-deltaMs / CAMERA_TAU_MS)
    this.cam.x += (tx - this.cam.x) * k
    this.cam.y += (ty - this.cam.y) * k
    const cam = this.cameras.main
    cam.centerOn(this.cam.x, this.cam.y)
    const headY = this.player.y - (FOOT_Y - HEAD_Y) * this.player.scaleY
    this.cb().onPlayerScreen((this.player.x - cam.worldView.x) * cam.zoom, (headY - cam.worldView.y) * cam.zoom)
  }

  private reportPosition(time: number) {
    if (time - this.saved.at < SAVE_EVERY_MS) return
    const { x, y } = this.player
    this.saved.at = time
    if (Math.hypot(x - this.saved.x, y - this.saved.y) < 2) return
    this.saved = { at: time, x, y }
    this.cb().onPlayerMoved([x, y])
  }

  private roomById(id: string): PlacedRoom | undefined {
    return this.map.rooms.find((r) => r.room.id === id)
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
    if (s) this.cb().onInteract({ kind: 'station', key: s.key, label: s.label, opens: s.opens })
  }

  private createAnims() {
    for (const motion of MOTIONS) {
      SHEET_DIRS.forEach((dir, i) => {
        const key = animKey(motion, dir)
        if (this.anims.exists(key)) return
        const start = i * FRAMES_PER_DIR
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(motion, { start, end: start + FRAMES_PER_DIR - 1 }),
          frameRate: FRAME_RATE[motion],
          repeat: -1,
        })
      })
    }
  }

  private playAnim(motion: Motion) {
    const { dir, flip } = sheetDir(this.facing)
    this.player.setFlipX(flip)
    if (this.anims.exists(animKey(motion, dir))) this.player.play(animKey(motion, dir), true)
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
    }
    for (const c of this.map.corridors) {
      c.polys.forEach((p) => draw(p, tokenColor('role-science')))
      draw(c.doorArea, tokenColor(c.door.color))
    }
    this.debug = g
    console.log('[world] F2 overlay on: click to log WORLD pixel coordinates (hq-map.json uses these)')
  }
}
