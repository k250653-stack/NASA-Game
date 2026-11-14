/**
 * Phaser scene for any walkable room (src/world/rooms/*.json): the room image, the player,
 * movement inside the walkable polygon, door/station detection, station glow, mouse clicks on
 * stations, and the F2 dev overlay. Menus, prompts and popups are React (see HQWorld).
 */
import Phaser from 'phaser'
import { getAsset } from '@/ui/assets'
import {
  animKey,
  facingFrom,
  FOOT_Y,
  FRAME_RATE,
  FRAME_SIZE,
  FRAMES_PER_DIR,
  HEAD_Y,
  MOTIONS,
  SHEET_DIRS,
  SHEET_FILE,
  sheetDir,
  type Facing,
  type Motion,
} from './character'
import { canStand, distanceToPolygon, pointInPolygon, type Point, type Polygon } from './geometry'
import type { Room } from './rooms/room'
import { addCutOutTexture } from './roomTexture'

/** Room pixels per second. */
const WALK_SPEED = 90
const RUN_SPEED = 170
const CAMERA_LERP = 0.1

export type Target = { kind: 'door' | 'station'; id: string }

export interface SceneCallbacks {
  onTarget: (target: Target | null) => void
  onInteract: (target: Target) => void
  /** Top of the player's helmet in canvas CSS pixels (for the React prompt). */
  onPlayerScreen: (x: number, y: number) => void
  onReady: () => void
  /** True while a popup or menu is open: no movement, keyboard released for React. */
  isPaused: () => boolean
}

export interface RoomSceneData {
  room: Room
  spawn: Point
}

type Keys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift',
  Phaser.Input.Keyboard.Key
>

/** Theme colour token (index.css) as a Phaser colour number. */
function tokenColor(name: string): number {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  return hex.startsWith('#') ? Phaser.Display.Color.HexStringToColor(hex.slice(0, 7)).color : 0xffffff
}

export class RoomScene extends Phaser.Scene {
  private readonly callbacks: () => SceneCallbacks
  private room!: Room
  private spawn!: Point
  private player!: Phaser.GameObjects.Sprite
  private keys!: Keys
  private facing: Facing = 'S'
  private target: Target | null = null
  private paused = false
  private glow: Phaser.GameObjects.Graphics | null = null
  private debug: Phaser.GameObjects.Graphics | null = null

  constructor(callbacks: () => SceneCallbacks) {
    super('room')
    this.callbacks = callbacks
  }

  init(data: RoomSceneData) {
    this.room = data.room
    this.spawn = data.spawn
    this.target = null
    this.glow = null
    this.debug = null
    this.paused = false
  }

  preload() {
    const { image, id } = this.room
    if (!this.textures.exists(`room-${id}`)) {
      this.load.image(`room-${id}`, getAsset(image.kind, image.id, image.ext))
    }
    for (const motion of MOTIONS) {
      if (this.textures.exists(motion)) continue
      const url = getAsset('sprites', `maincharacter/${SHEET_FILE[motion]}`, 'png')
      this.load.spritesheet(motion, url, { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE })
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn(`[world] could not load "${file.src}"`),
    )
  }

  create() {
    const { room } = this
    if (this.textures.exists(`room-${room.id}`)) {
      addCutOutTexture(this, `room-${room.id}`, `room-${room.id}-cut`)
      this.add.image(0, 0, `room-${room.id}-cut`).setOrigin(0)
    }
    this.createAnims()
    this.player = this.add
      .sprite(this.spawn[0], this.spawn[1], 'idle')
      .setOrigin(0.5, FOOT_Y / FRAME_SIZE)
      .setScale(room.playerScale)
      .setDepth(5)
    this.playAnim('idle')

    const kb = this.input.keyboard!
    const K = Phaser.Input.Keyboard.KeyCodes
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D, shift: K.SHIFT,
    }) as Keys
    kb.on('keydown-E', () => {
      if (this.target) this.callbacks().onInteract(this.target)
    })
    kb.addCapture(K.F2)
    kb.on('keydown-F2', () => this.toggleDebug())
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.input.setDefaultCursor(this.stationAt(p) ? 'pointer' : 'default')
    })

    const cam = this.cameras.main
    cam.setBounds(0, 0, room.size[0], room.size[1])
    cam.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP)
    this.scale.on('resize', this.fit, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.fit, this))
    this.fit()
    cam.centerOn(this.spawn[0], this.spawn[1]) // start on the player, no initial glide
    this.callbacks().onReady()
  }

  override update(_time: number, deltaMs: number) {
    this.syncPaused()
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
    const cam = this.cameras.main
    const headY = this.player.y - (FOOT_Y - HEAD_Y) * this.room.playerScale
    this.callbacks().onPlayerScreen(
      (this.player.x - cam.worldView.x) * cam.zoom,
      (headY - cam.worldView.y) * cam.zoom,
    )
  }

  /** Popups and menus take the keyboard: stop capturing WASD/arrows so inputs can be typed in. */
  private syncPaused() {
    const paused = this.callbacks().isPaused()
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
    const { walkable, blocked } = this.room
    const { x, y } = this.player
    const tries: Point[] = [[x + mx, y + my], [x + mx, y], [x, y + my]]
    const next = tries.find((p) => canStand(p, walkable as Polygon, blocked as Polygon[]))
    if (next) this.player.setPosition(next[0], next[1])
  }

  /** A door the player stands in, else the nearest station within reach. */
  private updateTarget() {
    const p: Point = [this.player.x, this.player.y]
    const door = this.room.doors.find((d) => pointInPolygon(p, d.area as Polygon))
    let target: Target | null = door ? { kind: 'door', id: door.id } : null
    if (!target) {
      let best = Infinity
      for (const s of this.room.stations) {
        const d = distanceToPolygon(p, s.area as Polygon)
        if (d <= s.reach && d < best) {
          best = d
          target = { kind: 'station', id: s.id }
        }
      }
    }
    if (target?.id === this.target?.id && target?.kind === this.target?.kind) return
    this.target = target
    this.drawGlow()
    this.callbacks().onTarget(target)
  }

  /** Pulsing outline around the station the player is next to. */
  private drawGlow() {
    this.glow?.destroy()
    this.glow = null
    const station =
      this.target?.kind === 'station' ? this.room.stations.find((s) => s.id === this.target?.id) : null
    if (!station) return
    const color = tokenColor('accent')
    const pts = (station.area as Polygon).map(([x, y]) => new Phaser.Math.Vector2(x, y))
    const g = this.add.graphics().setDepth(4)
    g.fillStyle(color, 0.08).fillPoints(pts, true)
    g.lineStyle(6, color, 0.25).strokePoints(pts, true)
    g.lineStyle(2, color, 0.9).strokePoints(pts, true)
    this.tweens.add({ targets: g, alpha: { from: 0.35, to: 1 }, duration: 650, yoyo: true, repeat: -1 })
    this.glow = g
  }

  private stationAt(p: Phaser.Input.Pointer) {
    const w = this.cameras.main.getWorldPoint(p.x, p.y)
    return this.room.stations.find((s) => pointInPolygon([w.x, w.y], s.area as Polygon))
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (this.debug) {
      const w = this.cameras.main.getWorldPoint(p.x, p.y)
      console.log(`[world] ${this.room.id} px: [${Math.round(w.x)}, ${Math.round(w.y)}]`)
      return
    }
    if (this.paused) return
    const station = this.stationAt(p)
    if (station) this.callbacks().onInteract({ kind: 'station', id: station.id })
  }

  private createAnims() {
    for (const motion of MOTIONS) {
      SHEET_DIRS.forEach((dir, i) => {
        const key = animKey(motion, dir)
        if (this.anims.exists(key)) return
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(motion, {
            start: i * FRAMES_PER_DIR,
            end: i * FRAMES_PER_DIR + FRAMES_PER_DIR - 1,
          }),
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

  /** Cover: zoom so the room fills the viewport; the camera follows inside the image bounds. */
  private fit() {
    const { size } = this.room
    const { width, height } = this.scale.gameSize
    const cam = this.cameras.main
    cam.setSize(width, height)
    cam.setZoom(Math.max(width / size[0], height / size[1]))
  }

  private toggleDebug() {
    if (this.debug) {
      this.debug.destroy()
      this.debug = null
      return
    }
    const { walkable, blocked, doors, stations } = this.room
    const g = this.add.graphics().setDepth(10)
    const draw = (poly: Polygon, color: number) => {
      const pts = poly.map(([x, y]) => new Phaser.Math.Vector2(x, y))
      g.fillStyle(color, 0.25).fillPoints(pts, true)
      g.lineStyle(1, color, 1).strokePoints(pts, true)
    }
    draw(walkable as Polygon, tokenColor('success'))
    for (const b of blocked) draw(b as Polygon, tokenColor('danger'))
    for (const s of stations) draw(s.area as Polygon, tokenColor('accent'))
    for (const d of doors) draw(d.area as Polygon, tokenColor(d.color))
    this.debug = g
    console.log(`[world] F2 overlay on (${this.room.id}): click to log room pixel coordinates`)
  }
}
