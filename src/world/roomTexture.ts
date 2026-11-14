import type Phaser from 'phaser'

/** Max per-channel difference from the corner colour that still counts as background. */
const TOLERANCE = 22

/**
 * Copies a loaded room image to a new texture with its flat surrounding colour made
 * transparent, so the HQ backdrop shows around the room. Only background connected to the image
 * border is removed (flood fill), so dark pixels inside the room stay.
 */
export function addCutOutTexture(scene: Phaser.Scene, srcKey: string, dstKey: string): void {
  if (scene.textures.exists(dstKey)) return
  const img = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, w, h)
  const px = image.data
  const r0 = px[0]!
  const g0 = px[1]!
  const b0 = px[2]!
  const isBg = (i: number) =>
    Math.abs(px[i]! - r0) <= TOLERANCE &&
    Math.abs(px[i + 1]! - g0) <= TOLERANCE &&
    Math.abs(px[i + 2]! - b0) <= TOLERANCE

  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
  while (stack.length) {
    const p = stack.pop()!
    if (seen[p] || !isBg(p * 4)) continue
    seen[p] = 1
    px[p * 4 + 3] = 0
    const x = p % w
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p < w * (h - 1)) stack.push(p + w)
  }
  ctx.putImageData(image, 0, 0)
  scene.textures.addCanvas(dstKey, canvas)
}
