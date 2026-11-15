import type { ReactNode } from 'react'
import type { CrewMember } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { PopupPanel } from '../PopupPanel'

export const SECTION = 'font-title text-sm tracking-widest text-alert uppercase'

interface StationShellProps {
  title: string
  testId: string
  /** Crew member posted here and what they say. */
  talk?: { member: CrewMember; line: string }
  onClose: () => void
  children: ReactNode
}

/** Same compact pixel popup for every habitat station: title, read-only info, a crew comment. */
export function StationShell({ title, testId, talk, onClose, children }: StationShellProps) {
  return (
    <PopupPanel size="compact" label={title} onClose={onClose}>
      <div className="space-y-4 p-5" data-testid={testId}>
        <h2 className="font-title text-2xl tracking-wide text-primary uppercase">{title}</h2>
        {children}
        {talk && (
          <div
            className="flex items-center gap-3 border-t border-border pt-3"
            data-testid="station-talk"
          >
            <AssetImage
              kind="portraits"
              id={talk.member.portrait}
              label={talk.member.name}
              className="size-10 shrink-0"
            />
            <p className="text-sm text-muted">
              <span className="font-title tracking-wide text-accent uppercase">
                Talk to {talk.member.name} ·{' '}
              </span>
              “{talk.line}”
            </p>
          </div>
        )}
      </div>
    </PopupPanel>
  )
}

/** "Label ........ value" row. */
export function Row({
  label,
  value,
  tone = 'text-primary',
}: {
  label: string
  value: ReactNode
  tone?: string
}) {
  return (
    <div className="flex justify-between gap-4 border-t border-border pt-1 text-sm">
      <span className="font-title tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-mono tabular-nums ${tone}`}>{value}</span>
    </div>
  )
}

export function MeterBar({ share, tone }: { share: number; tone: string }) {
  return (
    <span className="block h-2.5 w-full bg-surface">
      <span
        className={`block h-full ${tone}`}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%` }}
      />
    </span>
  )
}

export const gb = (v: number) => `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} GB`
