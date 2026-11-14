import { useState, type ImgHTMLAttributes } from 'react'
import { getAsset, type ImageAssetKind } from './assets'

interface AssetImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  kind: ImageAssetKind
  id: string
  /** Human label used for alt text and placeholder initials. Defaults to the id. */
  label?: string
  /** Tried if `id` fails to load (e.g. an expression portrait falling back to the normal one). */
  fallbackId?: string
}

/**
 * Renders an image from public/assets. If the file is missing or fails to load, it renders a
 * generated SVG placeholder (coloured rounded rect with initials) so the game never shows a
 * broken-image icon.
 */
export function AssetImage({
  kind,
  id,
  fallbackId,
  label,
  alt,
  className,
  ...rest
}: AssetImageProps) {
  const primary = getAsset(kind, id)
  const fallback = fallbackId ? getAsset(kind, fallbackId) : null
  // Tracking failed *srcs* (not a boolean) means a new id automatically retries the real file.
  const [failed, setFailed] = useState<string[]>([])
  const text = label ?? id
  const src = [primary, fallback].find((x): x is string => x !== null && !failed.includes(x))

  if (!src) {
    return <PlaceholderImage text={text} alt={alt ?? text} className={className} />
  }

  return (
    <img
      key={src}
      src={src}
      alt={alt ?? text}
      className={className}
      onError={() => setFailed((f) => [...f, src])}
      {...rest}
    />
  )
}

interface PlaceholderImageProps {
  text: string
  alt: string
  className?: string
}

export function PlaceholderImage({ text, alt, className }: PlaceholderImageProps) {
  const hue = hashHue(text)
  const initials = toInitials(text)
  return (
    <svg
      role="img"
      aria-label={alt}
      viewBox="0 0 100 100"
      className={className}
      data-placeholder-for={text}
    >
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="14"
        fill={`hsl(${hue} 45% 22%)`}
        stroke={`hsl(${hue} 60% 45%)`}
        strokeWidth="2"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize={initials.length > 2 ? 26 : 38}
        fill={`hsl(${hue} 70% 85%)`}
      >
        {initials}
      </text>
    </svg>
  )
}

/** Deterministic hue from a string (no Math.random: the same id always gets the same colour). */
function hashHue(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h % 360
}

/** "crew-mina-okafor" -> "MO", "moon-surface" -> "MS", "alarm" -> "AL". */
function toInitials(text: string): string {
  const words = text
    .replace(/^crew-/, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w && !/^(dr|mr|mrs|ms|prof|capt|cdr)$/i.test(w))
  if (words.length === 0) return '?'
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()
}
