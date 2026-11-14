import { useMemo } from 'react'
import { getContent } from '@/content/load'
import { signalDelay, turnOutput, type Turn } from '@/engine/timeline'
import type { Design } from '@/engine/types'
import type { Destination } from '@/schemas'
import { Badge } from '@/ui/Badge'

interface TimelineListProps {
  destination: Destination
  turns: readonly Turn[]
  design: Design
}

/** Every turn of the mission with its days, location, signal delay and output. */
export function TimelineList({ destination, turns, design }: TimelineListProps) {
  const rows = useMemo(() => {
    const content = getContent()
    return turns.map((turn) => ({
      turn,
      delaySec: signalDelay(destination, turn.startDay),
      out: turnOutput(design, content, turn),
    }))
  }, [destination, turns, design])

  return (
    <div className="max-h-96 overflow-y-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">Turn</th>
            <th className="px-3 py-2 font-medium">Phase</th>
            <th className="px-3 py-2 font-medium">Days</th>
            <th className="px-3 py-2 font-medium">Where</th>
            <th className="px-3 py-2 text-right font-medium">Signal delay</th>
            <th className="px-3 py-2 text-right font-medium">Science</th>
            <th className="px-3 py-2 text-right font-medium">Data home</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono tabular-nums">
          {rows.map(({ turn, delaySec, out }) => (
            <tr key={turn.turnIndex}>
              <td className="px-3 py-1.5 text-subtle">{turn.turnIndex + 1}</td>
              <td className="px-3 py-1.5 font-sans text-primary">{turn.phaseId}</td>
              <td className="px-3 py-1.5 text-muted">
                {turn.startDay}–{turn.startDay + turn.days}
                <span className="text-subtle"> ({turn.days}d)</span>
              </td>
              <td className="px-3 py-1.5">
                <Badge variant={turn.location === 'surface' ? 'info' : 'neutral'}>
                  {turn.location}
                </Badge>
              </td>
              <td className="px-3 py-1.5 text-right text-muted">
                {delaySec < 60 ? `${delaySec.toFixed(2)} s` : `${(delaySec / 60).toFixed(1)} min`}
              </td>
              <td className="px-3 py-1.5 text-right text-primary">{out.sciencePoints}</td>
              <td className="px-3 py-1.5 text-right text-muted">
                {out.dataReturnGb.toFixed(1)} GB
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
