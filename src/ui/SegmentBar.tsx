/** Blocky retro "health bar": fixed segments, filled left to right. */
export const SEGMENTS = 16

interface SegmentBarProps {
  /** 0-1 share filled. */
  share: number
  /** Tailwind background class for filled segments, e.g. "bg-accent". */
  fill: string
  segments?: number
  /** Segment height class. */
  height?: string
  className?: string
}

export function SegmentBar({
  share,
  fill,
  segments = SEGMENTS,
  height = 'h-2.5',
  className = '',
}: SegmentBarProps) {
  const on = Math.round(Math.max(0, Math.min(1, share)) * segments)
  return (
    <span className={`flex w-full gap-[2px] ${className}`} aria-hidden>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={`${height} flex-1 ${i < on ? fill : 'bg-surface'}`} />
      ))}
    </span>
  )
}
