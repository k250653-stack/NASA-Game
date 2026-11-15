import type { ReactNode } from 'react'
import type { CrewMember } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { SegmentBar } from '@/ui/SegmentBar'
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
    <PopupPanel section="Habitat" title={title} onClose={onClose}>
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-6" data-testid={testId}>
        {children}
        {talk && (
          <div
            className="flex items-center gap-3 border-t-2 border-border pt-4"
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
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="label-caps text-muted">{label}</span>
      <span className={`font-mono tabular-nums ${tone}`}>{value}</span>
    </div>
  )
}

export function MeterBar({ share, tone }: { share: number; tone: string }) {
  return (
    <SegmentBar share={share} fill={tone} />
  )
}

export const gb = (v: number) => `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} GB`
