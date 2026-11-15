import { motion, useReducedMotion } from 'motion/react'
import type { OverallCall, PollLine, PollVerdict } from '@/engine/launchPoll'
import type { CrewMember } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { ROLE_LABEL } from '@/ui/labels'
import { Panel } from '@/ui/Panel'
import { Tooltip } from '@/ui/Tooltip'

/** Seconds between voices in the poll, like a flight director going round the room. */
const STAGGER_S = 0.6

const VERDICT: Record<PollVerdict, { label: string; ring: string; text: string }> = {
  go: { label: 'Go', ring: 'border-success', text: 'text-success' },
  'go-with-concerns': { label: 'Go, concerns', ring: 'border-alert', text: 'text-alert' },
  'no-go': { label: 'No-go', ring: 'border-danger', text: 'text-danger' },
}
const CALL: Record<OverallCall, string> = {
  GO: 'border-success text-success',
  'GO WITH RISKS': 'border-alert text-alert',
  'NO-GO': 'border-danger text-danger',
}

interface PollPanelProps {
  lines: PollLine[]
  call: OverallCall
  crew: readonly CrewMember[]
  callsign: string
}

/** Portraits in a row light up green/amber/red one by one; each reason is on hover. */
export function PollPanel({ lines, call, crew, callsign }: PollPanelProps) {
  const reduced = useReducedMotion()
  const delay = (i: number) => (reduced ? 0 : i * STAGGER_S)
  return (
    <Panel title="Go / No-Go poll" subtitle="Hover a portrait to hear their reason.">
      <ol className="flex flex-wrap justify-center gap-5">
        {lines.map((l, i) => {
          const member = crew.find((m) => m.id === l.crewId)
          const v = VERDICT[l.verdict]
          return (
            <motion.li
              key={l.role}
              data-testid={`poll-${l.role}`}
              data-verdict={l.verdict}
              initial={{ opacity: 0.35 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay(i), duration: 0.2 }}
            >
              <Tooltip content={l.reason}>
                <button type="button" className="flex w-24 flex-col items-center gap-1">
                  <span className={`border-4 ${v.ring}`}>
                    <AssetImage
                      kind="portraits"
                      id={member?.portrait ?? 'crew-player'}
                      label={member?.name ?? (callsign || 'You')}
                      className="block size-16"
                    />
                  </span>
                  <span className="label-caps truncate text-sm text-primary">
                    {member ? member.name.split(' ')[0] : 'Your call'}
                  </span>
                  <span className="label-caps text-xs text-subtle">{ROLE_LABEL[l.role]}</span>
                  <span className={`label-caps text-sm ${v.text}`}>{v.label}</span>
                </button>
              </Tooltip>
            </motion.li>
          )
        })}
      </ol>
      <motion.p
        data-testid="final-call"
        data-call={call}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay(lines.length), duration: 0.2 }}
        className={`label-caps mt-5 border-2 py-2 text-center text-3xl ${CALL[call]}`}
      >
        {call}
      </motion.p>
    </Panel>
  )
}
