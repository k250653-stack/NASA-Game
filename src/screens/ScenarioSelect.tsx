import { getContent } from '@/content/load'
import { DIFFICULTIES, type Difficulty } from '@/schemas'
import { chooseScenario, useStore } from '@/store'
import { Button } from '@/ui/Button'
import { Panel } from '@/ui/Panel'
import { PhaseShell } from '@/ui/PhaseShell'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { ScenarioCard } from './scenario/ScenarioCard'
import { SeedControl } from './scenario/SeedControl'

export default function ScenarioSelect() {
  const content = getContent()
  const destinationId = useStore((s) => s.game.destinationId)
  const scenarioId = useStore((s) => s.game.scenarioId)
  const difficulty = useStore((s) => s.game.difficulty)
  const setDifficulty = useStore((s) => s.setDifficulty)
  const setPhase = useStore((s) => s.setPhase)
  const destination = content.destinations.find((d) => d.id === destinationId)
  const scenarios = content.scenarios.filter((s) => s.destinationId === destinationId)
  const levels = content.constants.difficulty
  const options = DIFFICULTIES.map((id) => ({
    id,
    label: levels[id].label,
    description: levels[id].description,
  }))

  return (
    <PhaseShell
      title="Choose a Scenario"
      description={
        destination ? `Missions available at ${destination.name}.` : 'Pick a destination first.'
      }
      headerAside={<SeedControl />}
      nextLabel="Continue"
      nextDisabled={!scenarioId}
      nextHint={scenarioId ? undefined : 'Pick a scenario to continue.'}
    >
      {!destination ? (
        <Panel title="No destination">
          <p className="text-muted">Choose the Moon or Mars before picking a scenario.</p>
          <Button className="mt-3" variant="secondary" onClick={() => setPhase('destination')}>
            ← Destinations
          </Button>
        </Panel>
      ) : (
        <>
          <Panel title="Difficulty">
            <SegmentedControl<Difficulty>
              label="Difficulty"
              options={options}
              value={difficulty}
              onChange={setDifficulty}
            />
          </Panel>
          <div className="flex flex-col gap-4">
            {scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                difficulty={difficulty}
                selected={s.id === scenarioId}
                onSelect={() => chooseScenario(s.id)}
              />
            ))}
          </div>
        </>
      )}
    </PhaseShell>
  )
}
