/**
 * The mission habitat in one Phaser scene: the room image, the player (same movement, collision
 * and F2 overlay as the HQ), the crew as role-tinted NPCs at their workstations, and the walks
 * they make when they act on an event. The HUD, popups and toasts are React (HabitatWorld).
 */
import Phaser from 'phaser'
import { getAsset } from '@/ui/assets'
import { playSound } from '@/ui/sound'
import { reportLoading } from '@/ui/loadingStore'
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
import { canStand, centroid, distanceToPolygon, type Point, type Polygon } from './geometry'
import { popOutline, tokenColor, tokenCss } from './hqArt'
import { createRng } from '@/engine/rng'
import { reducedMotion } from '@/ui/feel'
import type { Room, Workstation, WorkstationKind } from './rooms/room'
import { PlayerActor } from './player/PlayerActor'
import { addCutOutTexture } from './roomTexture'

/** Idle fidgets: how often one crew member moves, and how long a turn-round lasts, ms. */
const IDLE_EVERY_MS = 3500
const IDLE_TURN_MS = 1800
const FACINGS: readonly Facing[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
const NPC_SPEED = 110
const CAMERA_TAU_MS = 200
const ROOM_FOLLOW = 0.3
const VIEW_W = 1270
const VIEW_H = 760
/** How far (room px) crew wait back from their station, and when their name shows. */
const HOME_OFFSET = 42
const NAME_RANGE = 120
const TALK_RANGE = 60
const WORK_MS = 1100
const EVA_MS = 1600
const FADE_MS = 300

export interface NpcSpec {
  id: string
  name: string
  /** Theme colour token, e.g. "role-science". */
  color: string
  post: WorkstationKind
}

export type HabitatTarget =
  | { kind: 'crew'; key: string; label: string }
  | { kind: 'station'; key: WorkstationKind; label: string }

export interface HabitatCallbacks {
  onTarget: (target: HabitatTarget | null) => void
  onInteract: (target: HabitatTarget) => void
  onPlayerScreen: (x: number, y: number) => void
  isPaused: () => boolean
  /** Stations that need attention: a pulsing "!" floats above each. */
  alerts?: () => readonly WorkstationKind[]
  /** Crew whose event it is right now: a "!" bubble floats over them. */
  crewAlerts?: () => readonly string[]
  /** Station of the hands-on task waiting for the player: a cyan arrow bobs over it. */
  taskStation?: () => WorkstationKind | null
}

interface Npc {
  spec: NpcSpec
  sprite: Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  home: Point
  facing: Facing
  motion: Motion
  /** Queue of walks so overlapping actions play one after another. */
  busy: Promise<void>
  /** Walking to or working at a station (no idle fidgets). */
  acting: boolean
  bubble: Phaser.GameObjects.Text
}

type Keys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift',
  Phaser.Input.Keyboard.Key
>

export class HabitatScene extends Phaser.Scene {
  private readonly room: Room
  private readonly specs: NpcSpec[]
  private readonly cb: () => HabitatCallbacks
  private readonly center: Point
  private actor!: PlayerActor
  private player!: Phaser.GameObjects.Sprite
  private keys!: Keys
  private npcs = new Map<string, Npc>()
  private target: HabitatTarget | null = null
  private paused = false
  private glow: Phaser.GameObjects.Graphics | null = null
  private debug: Phaser.GameObjects.Graphics | null = null
  private cam = { x: 0, y: 0 }
  private dimmer: Phaser.GameObjects.Rectangle | null = null
  private taskArrow: Phaser.GameObjects.Graphics | null = null
  /** Seeded, so idle fidgets never use Math.random (CLAUDE.md rule 7). */
  private idleRng = createRng(31)
  private alertMarks = new Map<WorkstationKind, Phaser.GameObjects.Text>()

  constructor(room: Room, crew: NpcSpec[], callbacks: () => HabitatCallbacks) {
    super('habitat')
    this.room = room
    this.specs = crew
    this.cb = callbacks
    this.center = centroid(room.walkable[0]!)
  }

  preload() {
    reportLoading(0)
    this.load.on('progress', (p: number) => reportLoading(p))
    const { image } = this.room
    this.load.image('habitat', getAsset(image.kind, image.id, image.ext))
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
    if (this.textures.exists('habitat')) {
      addCutOutTexture(this, 'habitat', 'habitat-cut')
      this.add.image(0, 0, 'habitat-cut').setOrigin(0).setDepth(1)
    }
    this.createAnims()
    // The player is drawn from the player pack (cabin suit: helmet off inside the habitat).
    this.actor = new PlayerActor(this, this.center[0], this.center[1])
    this.actor.setVariant('cabin')
    this.player = this.actor.sprite.setDepth(5 + this.center[1] / 10000)
    this.specs.forEach((spec, i) => this.addNpc(spec, i))
    this.time.addEvent({ delay: IDLE_EVERY_MS, loop: true, callback: () => this.fidget() })
    this.dimmer = this.add
      .rectangle(0, 0, this.room.size[0], this.room.size[1], tokenColor('bg'))
      .setOrigin(0)
      .setDepth(7)
      .setAlpha(0)

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
    kb.on('keydown-E', () => {
      if (!this.target || this.paused) return
      const t = this.target
      const station = t.kind === 'station' ? this.station(t.key) : undefined
      if (station) popOutline(this, this.glow, centroid(station.area))
      this.cb().onInteract(t)
    })
    kb.addCapture(K.F2)
    kb.on('keydown-F2', () => this.toggleDebug())
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const w = this.cameras.main.getWorldPoint(p.x, p.y)
      if (this.debug) console.log(`[world] room px: [${Math.round(w.x)}, ${Math.round(w.y)}]`)
    })
    this.scale.on('resize', this.fit, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.fit, this))
    this.fit()
    this.cam = this.cameraTarget()
    this.cameras.main.centerOn(this.cam.x, this.cam.y)
  }

  override update(_time: number, deltaMs: number) {
    this.syncPaused()
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
    const alerted = this.cb().crewAlerts?.() ?? []
    for (const npc of this.npcs.values()) {
      npc.bubble
        .setVisible((npc.acting || alerted.includes(npc.spec.id)) && npc.sprite.alpha > 0.5)
        .setPosition(npc.sprite.x, this.headY(npc.sprite) - 22 + Math.sin(_time / 180) * 2)
      const near =
        Math.hypot(npc.sprite.x - this.player.x, npc.sprite.y - this.player.y) < NAME_RANGE
      npc.label
        .setVisible(near && npc.sprite.alpha > 0.5)
        .setPosition(npc.sprite.x, this.headY(npc.sprite) - 4)
      npc.sprite.setDepth(5 + npc.sprite.y / 10000)
    }
    this.player.setDepth(5 + this.player.y / 10000)
    this.updateTarget()
    this.updateAlerts(_time)
    this.updateTaskArrow(_time)
    this.updateCamera(deltaMs)
  }

  /** Pulsing "!" above stations React says need attention. */
  private updateAlerts(time: number) {
    const on = this.cb().alerts?.() ?? []
    for (const w of this.room.workstations) {
      let mark = this.alertMarks.get(w.kind)
      if (!on.includes(w.kind)) {
        mark?.setVisible(false)
        continue
      }
      if (!mark) {
        const [x] = centroid(w.area)
        const top = Math.min(...w.area.map((p) => p[1]))
        mark = this.add
          .text(x, top - 6, '!', {
            fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
            fontSize: '30px',
            fontStyle: 'bold',
            color: tokenCss('alert'),
            backgroundColor: tokenCss('bg'),
            padding: { x: 7, y: 0 },
          })
          .setOrigin(0.5, 1)
          .setDepth(9)
          .setResolution(2)
        this.alertMarks.set(w.kind, mark)
      }
      mark.setVisible(true).setAlpha(0.55 + 0.45 * Math.abs(Math.sin(time / 300)))
    }
  }

  /** Cyan arrow over the station where a hands-on task waits. */
  private updateTaskArrow(time: number) {
    const kind = this.cb().taskStation?.() ?? null
    const station = kind ? this.station(kind) : undefined
    if (!station) {
      this.taskArrow?.setVisible(false)
      return
    }
    if (!this.taskArrow) {
      const g = this.add.graphics().setDepth(9)
      g.fillStyle(tokenColor('accent'), 1).fillTriangle(-12, -18, 12, -18, 0, 0)
      g.fillStyle(tokenColor('bg'), 1).fillRect(-3, -15, 6, 6)
      this.taskArrow = g
    }
    const [x] = centroid(station.area)
    const top = Math.min(...station.area.map((p) => p[1]))
    this.taskArrow.setVisible(true).setPosition(x, top - 10 + Math.sin(time / 260) * 5)
  }

  /** Room lights flicker briefly (power events). Skipped with reduced motion. */
  flicker() {
    if (!this.dimmer || reducedMotion()) return
    this.tweens.chain({
      targets: this.dimmer,
      tweens: [
        { alpha: 0.55, duration: 60 },
        { alpha: 0.1, duration: 80 },
        { alpha: 0.45, duration: 50 },
        { alpha: 0, duration: 160 },
      ],
    })
  }

  /** Now and then an idle crew member turns round or does a small bounce. */
  private fidget() {
    const idle = [...this.npcs.values()].filter((n) => !n.acting && n.sprite.alpha > 0.5)
    if (idle.length === 0) return
    const npc = idle[this.idleRng.int(0, idle.length - 1)]!
    if (this.idleRng.chance(0.5)) {
      npc.facing = FACINGS[this.idleRng.int(0, FACINGS.length - 1)]!
      this.play(npc.sprite, 'idle', npc.facing)
      this.time.delayedCall(IDLE_TURN_MS, () => {
        const post = this.station(npc.spec.post)
        if (post && !npc.acting) this.faceStation(npc, post)
      })
    } else if (!reducedMotion()) {
      this.tweens.add({ targets: npc.sprite, y: npc.sprite.y - 4, duration: 120, yoyo: true })
    }
  }

  // ---- crew actions (called from React) --------------------------------------------------------

  /** Walks a crew member to a workstation, works there (or goes out of the airlock), and returns. */
  act(crewId: string, kind: WorkstationKind): Promise<void> {
    const npc = this.npcs.get(crewId)
    const station = this.station(kind)
    if (!npc || !station) return Promise.resolve()
    npc.busy = npc.busy.then(async () => {
      npc.acting = true
      await this.walk(npc, station.stand)
      this.faceStation(npc, station)
      if (kind === 'airlock') {
        await this.tween(npc.sprite, { alpha: 0 }, FADE_MS)
        await this.wait(EVA_MS)
        await this.tween(npc.sprite, { alpha: 1 }, FADE_MS)
      } else {
        await this.wait(WORK_MS)
      }
      await this.walk(npc, npc.home)
      const post = this.station(npc.spec.post)
      if (post) this.faceStation(npc, post)
      npc.acting = false
    })
    return npc.busy
  }

  private addNpc(spec: NpcSpec, i: number) {
    const station = this.station(spec.post)
    const base = station?.stand ?? this.center
    const [cx, cy] = this.center
    const len = Math.hypot(cx - base[0], cy - base[1]) || 1
    // Same post twice (e.g. a 4-person crew): stand a little apart.
    const spread = this.specs.slice(0, i).filter((s) => s.post === spec.post).length * 34
    const home: Point = [
      base[0] + ((cx - base[0]) / len) * HOME_OFFSET + spread,
      base[1] + ((cy - base[1]) / len) * HOME_OFFSET,
    ]
    const sprite = this.makeSprite(home).setTint(tokenColor(spec.color))
    const label = this.add
      .text(home[0], home[1], spec.name, {
        fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
        fontSize: '15px',
        color: tokenCss('primary'),
        backgroundColor: tokenCss('bg'),
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(8)
      .setResolution(2)
      .setVisible(false)
    const npc: Npc = {
      spec,
      sprite,
      label,
      home,
      facing: 'N',
      motion: 'idle',
      busy: Promise.resolve(),
      acting: false,
      bubble: this.add
        .text(home[0], home[1], '!', {
          fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
          fontSize: '22px',
          color: tokenCss('bg'),
          backgroundColor: tokenCss('alert'),
          padding: { x: 6, y: 0 },
        })
        .setOrigin(0.5, 1)
        .setDepth(9)
        .setResolution(2)
        .setVisible(false),
    }
    this.npcs.set(spec.id, npc)
    if (station) this.faceStation(npc, station)
    else this.play(sprite, 'idle', 'S')
  }

  private async walk(npc: Npc, to: Point) {
    const dx = to[0] - npc.sprite.x
    const dy = to[1] - npc.sprite.y
    const dist = Math.hypot(dx, dy)
    if (dist < 2) return
    npc.facing = facingFrom(dx, dy)
    this.play(npc.sprite, 'walk', npc.facing)
    await this.tween(npc.sprite, { x: to[0], y: to[1] }, (dist / NPC_SPEED) * 1000)
    this.play(npc.sprite, 'idle', npc.facing)
  }

  private faceStation(npc: Npc, station: Workstation) {
    const [sx, sy] = centroid(station.area)
    npc.facing = facingFrom(sx - npc.sprite.x, sy - npc.sprite.y)
    this.play(npc.sprite, 'idle', npc.facing)
  }

  private station(kind: WorkstationKind): Workstation | undefined {
    return this.room.workstations.find((w) => w.kind === kind)
  }

  private tween(target: object, props: Record<string, number>, duration: number): Promise<void> {
    return new Promise((resolve) =>
      this.tweens.add({ targets: target, ...props, duration, onComplete: () => resolve() }),
    )
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve))
  }

  // ---- player, targets, camera ----------------------------------------------------------------

  private makeSprite([x, y]: Point): Phaser.GameObjects.Sprite {
    return this.add
      .sprite(x, y, 'idle')
      .setOrigin(0.5, FOOT_Y / FRAME_SIZE)
      .setScale(this.room.playerScale)
      .setDepth(5)
  }

  private headY(s: Phaser.GameObjects.Sprite): number {
    return s.y - (FOOT_Y - HEAD_Y) * s.scaleY
  }

  private syncPaused() {
    const paused = this.cb().isPaused()
    if (paused === this.paused) return
    this.paused = paused
    const kb = this.input.keyboard!
    kb.resetKeys()
    if (paused) {
      kb.enabled = false
      kb.disableGlobalCapture()
      return
    }
    // Last popup closed: restore everything (see HQScene.syncPaused).
    kb.enabled = true
    kb.manager.enabled = true
    kb.enableGlobalCapture()
  }

  private move(mx: number, my: number) {
    const { x, y } = this.player
    const tries: Point[] = [
      [x + mx, y + my],
      [x + mx, y],
      [x, y + my],
    ]
    const next = tries.find((p) => canStand(p, this.room.walkable, this.room.blocked))
    if (next) this.player.setPosition(next[0], next[1])
  }

  /** The nearest crew member in talking range, else the nearest workstation in reach. */
  private updateTarget() {
    const p: Point = [this.player.x, this.player.y]
    let target: HabitatTarget | null = null
    let best = TALK_RANGE
    for (const npc of this.npcs.values()) {
      const d = Math.hypot(npc.sprite.x - p[0], npc.sprite.y - p[1])
      if (d < best && npc.sprite.alpha > 0.5) {
        best = d
        target = { kind: 'crew', key: npc.spec.id, label: npc.spec.name }
      }
    }
    if (!target) {
      let near = Infinity
      for (const w of this.room.workstations) {
        const d = distanceToPolygon(p, w.area)
        if (d <= w.reach && d < near) {
          near = d
          target = { kind: 'station', key: w.kind, label: w.label }
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
    const t = this.target
    const station = t?.kind === 'station' ? this.station(t.key) : undefined
    if (!station) return
    const color = tokenColor('accent')
    const pts = station.area.map(([x, y]) => new Phaser.Math.Vector2(x, y))
    const g = this.add.graphics().setDepth(4)
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

  private cameraTarget(): { x: number; y: number } {
    const [cx, cy] = this.center
    return {
      x: cx + (this.player.x - cx) * ROOM_FOLLOW,
      y: cy - 60 + (this.player.y - cy) * ROOM_FOLLOW,
    }
  }

  private updateCamera(deltaMs: number) {
    const t = this.cameraTarget()
    const k = 1 - Math.exp(-deltaMs / CAMERA_TAU_MS)
    this.cam.x += (t.x - this.cam.x) * k
    this.cam.y += (t.y - this.cam.y) * k
    const cam = this.cameras.main
    cam.centerOn(this.cam.x, this.cam.y)
    const v = cam.worldView
    this.cb().onPlayerScreen(
      (this.player.x - v.x) * cam.zoom,
      (this.actor.headY() - v.y) * cam.zoom,
    )
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

  private play(sprite: Phaser.GameObjects.Sprite, motion: Motion, facing: Facing) {
    const { dir, flip } = sheetDir(facing)
    sprite.setFlipX(flip)
    if (this.anims.exists(animKey(motion, dir))) sprite.play(animKey(motion, dir), true)
  }

  private fit() {
    const { width, height } = this.scale.gameSize
    const cam = this.cameras.main
    cam.setSize(width, height)
    cam.setZoom(Math.min(width / VIEW_W, height / VIEW_H))
  }

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
    this.room.walkable.forEach((f) => draw(f, tokenColor('success')))
    this.room.blocked.forEach((b) => draw(b, tokenColor('danger')))
    for (const w of this.room.workstations) {
      draw(w.area, tokenColor('accent'))
      g.fillStyle(tokenColor('alert'), 1).fillCircle(w.stand[0], w.stand[1], 4)
    }
    this.debug = g
    console.log('[world] F2 overlay on: click to log room pixel coordinates')
  }
}
