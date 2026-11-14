/**
 * Phaser scene for a walkable room: the room image, the player, movement inside the walkable
 * polygon, door detection, and the F2 dev overlay. Menus and prompts are React (see HQLobby).
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
import { canStand, pointInPolygon, type Point, type Polygon } from './geometry'
import type { Door, Room } from './rooms/room'

/** Room pixels per second. */
const WALK_SPEED = 90
const RUN_SPEED = 170

export interface SceneCallbacks {
  onNearDoor: (door: Door | null) => void
  onInteract: (door: Door) => void
  /** Top of the player's helmet in canvas CSS pixels (for the React prompt). */
  onPlayerScreen: (x: number, y: number) => void
}

export interface LobbySceneOptions {
  room: Room
  spawn: Point
  /** Getter so React can swap callbacks without restarting Phaser. */
  callbacks: () => SceneCallbacks
}

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift', Phaser.Input.Keyboard.Key>

/** Theme colour token (index.css) as a Phaser colour number. */
function tokenColor(name: string): number {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  return hex.startsWith('#') ? Phaser.Display.Color.HexStringToColor(hex.slice(0, 7)).color : 0xffffff
}

export class LobbyScene extends Phaser.Scene {
  private readonly opts: LobbySceneOptions
  private player!: Phaser.GameObjects.Sprite
  private keys!: Keys
  private facing: Facing = 'S'
  private nearDoor: Door | null = null
  private debug: Phaser.GameObjects.Graphics | null = null

  constructor(opts: LobbySceneOptions) {
    super('lobby')
    this.opts = opts
  }

  preload() {
    const { image } = this.opts.room
    this.load.image('room', getAsset(image.kind, image.id, image.ext))
    for (const motion of MOTIONS) {
      this.load.spritesheet(motion, getAsset('sprites', `maincharacter/${SHEET_FILE[motion]}`, 'png'), {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      })
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn(`[world] could not load "${file.src}"`),
    )
  }

  create() {
    const { room, spawn } = this.opts
    // Fill the screen with the image's own corner colour so the room floats seamlessly.
    if (this.textures.exists('room')) {
      const bg = this.textures.getPixel(2, 2, 'room')
      if (bg) this.cameras.main.setBackgroundColor(bg.color)
      this.add.image(0, 0, 'room').setOrigin(0)
    }
    this.createAnims()
    this.player = this.add
      .sprite(spawn[0], spawn[1], 'idle')
      .setOrigin(0.5, FOOT_Y / FRAME_SIZE)
      .setScale(room.playerScale)
    this.playAnim('idle')

    const kb = this.input.keyboard!
    const K = Phaser.Input.Keyboard.KeyCodes
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D, shift: K.SHIFT,
    }) as Keys
    kb.on('keydown-E', () => {
      if (this.nearDoor) this.opts.callbacks().onInteract(this.nearDoor)
    })
    kb.addCapture(K.F2)
    kb.on('keydown-F2', () => this.toggleDebug())
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.debug) return
      const w = this.cameras.main.getWorldPoint(p.x, p.y)
      console.log(`[world] room px: [${Math.round(w.x)}, ${Math.round(w.y)}]`)
    })

    this.scale.on('resize', this.fit, this)
    this.fit()
  }

  override update(_time: number, deltaMs: number) {
    const k = this.keys
    const dx = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown)
    const dy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown)
    if (dx || dy) {
      const running = k.shift.isDown
      const step = ((running ? RUN_SPEED : WALK_SPEED) * deltaMs) / 1000 / Math.hypot(dx, dy)
      this.move(dx * step, dy * step)
      this.facing = facingFrom(dx, dy)
      this.playAnim(running ? 'run' : 'walk')
    } else {
      this.playAnim('idle')
    }
    this.updateDoor()
    const { x, y } = this.toScreen(this.player.x, this.player.y - (FOOT_Y - HEAD_Y) * this.opts.room.playerScale)
    this.opts.callbacks().onPlayerScreen(x, y)
  }

  /** Moves if the new spot is standable; otherwise slides along one axis. */
  private move(mx: number, my: number) {
    const { walkable, blocked } = this.opts.room
    const { x, y } = this.player
    const tries: Point[] = [[x + mx, y + my], [x + mx, y], [x, y + my]]
    const next = tries.find((p) => canStand(p, walkable as Polygon, blocked as Polygon[]))
    if (next) this.player.setPosition(next[0], next[1])
  }

  private updateDoor() {
    const p: Point = [this.player.x, this.player.y]
    const door = this.opts.room.doors.find((d) => pointInPolygon(p, d.area as Polygon)) ?? null
    if (door?.id === this.nearDoor?.id) return
    this.nearDoor = door
    this.opts.callbacks().onNearDoor(door)
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

  /** Whole-number zoom (pixel-perfect) when the room fits; shrink only on small screens. */
  private fit() {
    const { size, fit } = this.opts.room
    const { width, height } = this.scale.gameSize
    const s = Math.min(width / size[0], height / size[1])
    const zoom = s >= 1 ? Math.floor(s) : Math.min(1, width / fit[0], height / fit[1])
    const cam = this.cameras.main
    cam.setSize(width, height)
    cam.setZoom(zoom)
    cam.centerOn(size[0] / 2, size[1] / 2)
  }

  /** Room pixels to canvas CSS pixels (the camera is always centred on the room). */
  private toScreen(x: number, y: number) {
    const cam = this.cameras.main
    const { size } = this.opts.room
    return {
      x: (x - size[0] / 2) * cam.zoom + cam.width / 2,
      y: (y - size[1] / 2) * cam.zoom + cam.height / 2,
    }
  }

  private toggleDebug() {
    if (this.debug) {
      this.debug.destroy()
      this.debug = null
      return
    }
    const { walkable, blocked, doors } = this.opts.room
    const g = this.add.graphics().setDepth(10)
    const draw = (poly: Polygon, color: number) => {
      const pts = poly.map(([x, y]) => new Phaser.Math.Vector2(x, y))
      g.fillStyle(color, 0.25).fillPoints(pts, true)
      g.lineStyle(1, color, 1).strokePoints(pts, true)
    }
    draw(walkable as Polygon, tokenColor('success'))
    for (const b of blocked) draw(b as Polygon, tokenColor('danger'))
    for (const d of doors) draw(d.area as Polygon, tokenColor(d.color))
    this.debug = g
    console.log('[world] F2 overlay on: click to log room pixel coordinates')
  }
}
