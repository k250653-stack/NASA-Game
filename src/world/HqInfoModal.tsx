import { getContent } from '@/content/load'
import { isMissionOver } from '@/engine/mission'
import { useStore } from '@/store'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { getHqMap } from './hqMap'

interface HqInfoModalProps {
  open: boolean
  onClose: () => void
  /** Lock reason per gated room id (null = open), as HQWorld computes it. */
  locks: Record<string, string | null>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
      <dt className="label-caps text-xs text-muted">{label}</dt>
      <dd className="text-right text-sm text-primary">{value}</dd>
    </div>
  )
}

/** Lobby reception desk: where the current mission stands and what to do next. */
export function HqInfoModal({ open, onClose, locks }: HqInfoModalProps) {
  const destinationId = useStore((s) => s.game.destinationId)
  const scenarioId = useStore((s) => s.game.scenarioId)
  const roleChoice = useStore((s) => s.game.roleChoice)
  const crewCount = useStore((s) => s.crew.recruitedIds.length)
  const run = useStore((s) => s.mission.run)
  const content = getContent()
  const destination = content.destinations.find((d) => d.id === destinationId)
  const scenario = content.scenarios.find((s) => s.id === scenarioId)
  const role = content.roles.find((r) => r.id === roleChoice)

  const map = getHqMap()
  const nextLocked = map.rooms.find((r) => r.gate && locks[r.id])
  const status = run
    ? isMissionOver(run)
      ? 'Mission over: the debrief waits in Briefing.'
      : 'Mission in flight.'
    : nextLocked
      ? `Next: ${nextLocked.name} opens when you ${locks[nextLocked.id]?.replace(/\.$/, '').toLowerCase()}.`
      : 'Every room is open: Launch Control is ready.'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="HQ info"
      size="sm"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <dl data-testid="hq-info">
        <Row label="Destination" value={destination?.name ?? 'Not chosen'} />
        <Row label="Scenario" value={scenario?.name ?? 'Not chosen'} />
        <Row label="Your seat" value={role?.name ?? 'Not chosen'} />
        <Row label="Crew recruited" value={String(crewCount)} />
      </dl>
      <p className="mt-3 text-sm text-muted">{status}</p>
    </Modal>
  )
}
