import { motion, useReducedMotion } from 'motion/react'
import type { OverallCall, PollLine, PollVerdict } from '@/engine/launchPoll'
import type { CrewMember } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { ROLE_LABEL } from '@/ui/labels'
import { Panel } from '@/ui/Panel'
import { roleClasses } from '@/ui/roleColors'

/** Seconds between voices in the poll, like a flight director going round the room. */
const STAGGER_S = 0.6

const VERDICT: Record<PollVerdict, { label: string; badge: 'success' | 'warning' | 'danger' }> = {
  go: { label: 'Go', badge: 'success' },
  'go-with-concerns': { label: 'Go, with concerns', badge: 'warning' },
  'no-go': { label: 'No-go', badge: 'danger' },
}
const CALL: Record<OverallCall, string> = {
  GO: 'border-success/60 bg-success/10 text-success',
  'GO WITH RISKS': 'border-alert/60 bg-alert/10 text-alert',
  'NO-GO': 'border-danger/60 bg-danger/10 text-danger',
}

interface PollPanelProps {
  lines: PollLine[]
  call: OverallCall
  crew: readonly CrewMember[]
  callsign: string
}

/** Each seat announces its verdict in turn; the final call appears after the last voice. */
export function PollPanel({ lines, call, crew, callsign }: PollPanelProps) {
  const reduced = useReducedMotion()
  const delay = (i: number) => (reduced ? 0 : i * STAGGER_S)
  return (
    <Panel title="Go / No-Go poll" padded={false}>
      <ol>
        {lines.map((l, i) => {
          const member = crew.find((m) => m.id === l.crewId)
          return (
            <motion.li
              key={l.role}
              data-testid={`poll-${l.role}`}
              data-verdict={l.verdict}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay(i), duration: 0.3 }}
              className={`flex gap-3 border-b border-l-4 border-border px-4 py-3 ${roleClasses(l.role).border}`}
            >
              <AssetImage
                kind="portraits"
                id={member?.portrait ?? 'crew-player'}
                label={member?.name ?? (callsign || 'You')}
                className="size-11 shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-primary">
                    {member ? member.name : 'Your call'}
                  </p>
                  <span className={`text-xs ${roleClasses(l.role).text}`}>
                    {ROLE_LABEL[l.role]}
                  </span>
                  <Badge variant={VERDICT[l.verdict].badge} className="ml-auto">
                    {VERDICT[l.verdict].label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{l.reason}</p>
              </div>
            </motion.li>
          )
        })}
      </ol>
      <motion.p
        data-testid="final-call"
        data-call={call}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay(lines.length), duration: 0.3 }}
        className={`m-4 rounded-md border px-4 py-3 text-center font-display text-2xl font-bold tracking-widest ${CALL[call]}`}
      >
        {call}
      </motion.p>
    </Panel>
  )
}
