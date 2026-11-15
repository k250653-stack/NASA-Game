import { SegmentBar } from './SegmentBar'
import { useLoading } from './loadingStore'

/** "LOADING · MISSION CONTROL" with a blocky bar, over everything while the world loads. */
export function LoadingScreen({ progress }: { progress?: number | null }) {
  const reported = useLoading((s) => s.progress)
  const p = progress !== undefined ? progress : reported
  if (p === null) return null
  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-bg"
      data-testid="loading-screen"
      role="status"
    >
      <p className="label-caps text-3xl tracking-[0.3em] text-primary">
        Loading <span className="text-accent">·</span> Mission Control
      </p>
      <SegmentBar share={p} fill="bg-alert" segments={20} height="h-4" className="w-80" />
      <p className="font-mono text-sm text-muted tabular-nums">{Math.round(p * 100)}%</p>
    </div>
  )
}
