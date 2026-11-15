import { useState } from 'react'
import { getContent } from '@/content/load'
import { changeDestination, useStore } from '@/store'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { PhaseShell } from '@/ui/PhaseShell'
import { DestinationCard } from './destination/DestinationCard'

export default function DestinationSelect() {
  const destinations = getContent().destinations
  const selected = useStore((s) => s.game.destinationId)
  const hasLaterChoices = useStore(
    (s) => s.game.scenarioId !== null || s.crew.recruitedIds.length > 0,
  )
  const [pending, setPending] = useState<string | null>(null)

  const choose = (id: string) => {
    if (id === selected) return
    // Switching destination clears the scenario, role and crew, so confirm first.
    if (selected && hasLaterChoices) setPending(id)
    else changeDestination(id)
  }
  const pendingName = destinations.find((d) => d.id === pending)?.name

  return (
    <PhaseShell
      title="Choose a Destination"
      description="Where is your crew going? Everything that follows, from the scenario to the parts you can fly, depends on this choice."
      nextLabel="Continue"
      nextDisabled={!selected}
      nextHint={selected ? undefined : 'Pick a destination to continue.'}
    >
      <div className="grid grid-cols-2 gap-4">
        {destinations.map((d) => (
          <DestinationCard
            key={d.id}
            destination={d}
            selected={d.id === selected}
            onSelect={() => choose(d.id)}
          />
        ))}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={`Switch to ${pendingName ?? 'this destination'}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Keep current
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pending) changeDestination(pending)
                setPending(null)
              }}
            >
              Switch and reset
            </Button>
          </>
        }
      >
        <p className="text-muted">
          Changing destination clears your scenario, difficulty, role and recruited crew. Your seed
          and callsign are kept.
        </p>
      </Modal>
    </PhaseShell>
  )
}
