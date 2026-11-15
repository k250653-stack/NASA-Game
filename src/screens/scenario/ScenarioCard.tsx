import { getContent } from '@/content/load'
import { effectiveBudgetM } from '@/engine/difficulty'
import type { Difficulty, Scenario } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Card } from '@/ui/Card'
import { Icon } from '@/ui/Icon'
import { StatChip } from '@/ui/StatChip'
import { destinationArt } from '../destination/DestinationCard'

interface ScenarioCardProps {
  scenario: Scenario
  difficulty: Difficulty
  selected: boolean
  onSelect: () => void
}

/** Scenario card: art, objective, key numbers (budget after difficulty) and bonus objectives. */
export function ScenarioCard({ scenario: s, difficulty, selected, onSelect }: ScenarioCardProps) {
  const budget = effectiveBudgetM(s, difficulty, getContent())
  return (
    <Card
      selected={selected}
      onSelect={onSelect}
      label={s.name}
      padded={false}
      testId={`scenario-card-${s.id}`}
    >
      <div className="grid grid-cols-[10rem_minmax(0,1fr)]">
        <AssetImage
          kind="backgrounds"
          id={destinationArt(s.destinationId)}
          ext="png"
          label={s.name}
          className="h-full max-h-36 w-full object-cover"
        />
        <div className="p-3">
          <h2 className="font-display text-xl font-bold text-primary">{s.name}</h2>
          <p className="mt-1 text-sm text-muted">{s.objective}</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            <StatChip compact className="w-full" label="Duration" value={s.durationDays} unit="days" />
            <StatChip compact className="w-full" icon="IconUsers" label="Crew" value={s.crewSize} />
            <StatChip
              compact
              className="w-full"
              icon="IconCoin"
              label="Budget"
              value={`$${budget.toLocaleString('en-US')}`}
              unit="M"
              tone="accent"
            />
            <StatChip compact className="w-full" icon="IconFlask" label="Science target" value={s.scienceTarget} unit="pts" />
          </div>
          {s.bonusObjectives.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-sm">
              {s.bonusObjectives.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-muted">
                  <Icon name="IconCircleCheck" size={16} className="text-success" />
                  <span>{b.label}</span>
                  <span className="font-mono text-xs text-subtle">+{b.points}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}
