/**
 * The player character in a Phaser scene, drawn from the player pack (compact atlases, whole-number
 * scale 1, pixelated). Both appearances and both suits are loaded, so switching is instant.
 * The scene owns collision: it passes a `tryMove` callback and the actor never touches the map.
 */
import Phaser from 'phaser'
import { useStore } from '@/store'
import {
  COMPACT_SCALE,
  facingFromKeys,
  findSheet,
  footfallMs,
  frameIndex,
  groundVelocity,
  MANIFEST_URL,
  PLAYER_APPEARANCES,
  PLAYER_VARIANTS,
  playerAssetUrl,
  sheetKey,
  speedFactor,
  type PlayerAction,
  type PlayerAppearance,
  type PlayerDirection,
  type PlayerManifest,
  type PlayerVariant,
} from './playerPack'

const MANIFEST_KEY = 'player-manifest'
const ACTIONS: readonly PlayerAction[] = ['idle', 'walk']
/** Display scale of the compact atlas. Whole number, so pixels stay crisp. */
const DISPLAY_SCALE = 1
/** Distance from the feet to the top of the helmet, in compact pixels (for prompts). */
const HEAD_HEIGHT = 80

export interface PlayerInput {
  dx: number
  dy: number
  running: boolean
}

export class PlayerActor {
  readonly sprite: Phaser.GameObjects.Sprite
  private readonly manifest: PlayerManifest
  private appearance: PlayerAppearance
  private variant: PlayerVariant = 'cabin'
  private direction: PlayerDirection = 'S'
  private action: PlayerAction = 'idle'
  /** State-local clock: kept while turning, restarted only when idle/walk changes. */
  private clockMs = 0
  private lastKey = ''
  private lastFrame = -1
  private stepMs = 0

  /** Queue the manifest and every sheet. Call from the scene's preload(). */
  static preload(scene: Phaser.Scene): void {
    scene.load.json(MANIFEST_KEY, MANIFEST_URL)
    scene.load.once(Phaser.Loader.Events.FILE_COMPLETE + '-json-' + MANIFEST_KEY, () => {
      const m = scene.cache.json.get(MANIFEST_KEY) as PlayerManifest
      const { width, height } = m.compactFrame
      for (const player of PLAYER_APPEARANCES)
        for (const variant of PLAYER_VARIANTS)
          for (const action of ACTIONS) {
            const key = sheetKey(player, variant, action)
            if (scene.textures.exists(key)) continue
            const sheet = findSheet(m, player, variant, action)
            scene.load.spritesheet(key, playerAssetUrl(sheet.compactPath), {
              frameWidth: width,
              frameHeight: height,
            })
          }
    })
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.manifest = scene.cache.json.get(MANIFEST_KEY) as PlayerManifest
    this.appearance = useStore.getState().game.playerAppearance
    const { origin, width, height } = this.manifest.compactFrame
    this.sprite = scene.add
      .sprite(x, y, sheetKey(this.appearance, this.variant, 'idle'), 0)
      .setOrigin(origin.x / width, origin.y / height)
      .setScale(DISPLAY_SCALE)
    this.render(true)
  }

  /** Helmet off in pressurised rooms, sealed helmet outside. */
  setVariant(variant: PlayerVariant): void {
    this.variant = variant
  }

  /** Top of the helmet in world pixels. */
  headY(): number {
    return this.sprite.y - HEAD_HEIGHT * DISPLAY_SCALE
  }

  /**
   * One frame: faces the input, moves through `tryMove` at the speed that matches the animation,
   * and picks the frame. Returns true while the player is walking.
   */
  update(
    deltaMs: number,
    input: PlayerInput | null,
    tryMove: (mx: number, my: number) => void,
    onStep?: () => void,
  ): boolean {
    // Appearance can change from the pause menu at any time.
    this.appearance = useStore.getState().game.playerAppearance
    const moving = input !== null && (input.dx !== 0 || input.dy !== 0)
    const next: PlayerAction = moving ? 'walk' : 'idle'
    if (next !== this.action) {
      this.action = next
      this.clockMs = 0
      this.stepMs = 0
    }
    if (moving) {
      this.direction = facingFromKeys(input.dx, input.dy, this.direction)
      const factor = speedFactor(input.running)
      const v = groundVelocity(this.manifest, this.direction)
      const k = (COMPACT_SCALE * DISPLAY_SCALE * factor * deltaMs) / 1000
      tryMove(v.x * k, v.y * k)
      this.clockMs += deltaMs * factor
      this.stepMs += deltaMs
      if (onStep && this.stepMs >= footfallMs(factor)) {
        this.stepMs = 0
        onStep()
      }
    } else {
      this.clockMs += deltaMs
    }
    this.render(false)
    return moving
  }

  private render(force: boolean): void {
    const sheet = findSheet(this.manifest, this.appearance, this.variant, this.action)
    const key = sheetKey(this.appearance, this.variant, this.action)
    const frame = frameIndex(this.direction, this.clockMs, sheet.fps, sheet.frameCount)
    if (!force && key === this.lastKey && frame === this.lastFrame) return
    this.lastKey = key
    this.lastFrame = frame
    if (this.sprite.scene.textures.exists(key)) this.sprite.setTexture(key, frame)
  }
}
