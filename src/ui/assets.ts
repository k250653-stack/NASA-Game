/**
 * Typed asset paths. Files live in public/assets/<kind>/<id>.<ext> and are served from /assets/.
 * See public/assets/ASSETS.md for the list of expected files.
 */
export const IMAGE_KINDS = ['portraits', 'sprites', 'backgrounds'] as const
export const AUDIO_KINDS = ['sounds', 'music'] as const

export type ImageAssetKind = (typeof IMAGE_KINDS)[number]
export type AudioAssetKind = (typeof AUDIO_KINDS)[number]
export type AssetKind = ImageAssetKind | AudioAssetKind

const EXTENSION: Record<AssetKind, string> = {
  portraits: 'webp',
  sprites: 'webp',
  backgrounds: 'webp',
  sounds: 'mp3',
  music: 'mp3',
}

/** `getAsset('portraits', 'crew-mina-okafor')` -> "/assets/portraits/crew-mina-okafor.webp" */
export function getAsset(kind: AssetKind, id: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}/assets/${kind}/${id}.${EXTENSION[kind]}`
}
