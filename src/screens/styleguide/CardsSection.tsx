import { useState } from 'react'
import { getContent } from '@/content/load'
import { candidates } from '@/engine/recruitment'
import { Card } from '@/ui/Card'
import { CrewCard } from '@/ui/CrewCard'
import { Panel } from '@/ui/Panel'
import { PartCard } from '@/ui/PartCard'

export function CardsSection() {
  const content = getContent()
  // Recruitable crew only: player characters ("You") are not cards.
  const crew = candidates(content)
  const parts = content.parts
  const [picked, setPicked] = useState<string[]>([crew[0]?.id ?? '', parts[1]?.id ?? ''])
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <>
      <Panel title="Card" subtitle="Static, selectable, selected, disabled">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-muted">Static card</p>
          </Card>
          <Card onSelect={() => toggle('demo-a')} selected={picked.includes('demo-a')}>
            <p className="text-sm text-primary">Selectable (click me)</p>
          </Card>
          <Card onSelect={() => undefined} selected>
            <p className="text-sm text-primary">Selected</p>
          </Card>
          <Card onSelect={() => undefined} disabled>
            <p className="text-sm text-muted">Disabled</p>
          </Card>
        </div>
      </Panel>

      <Panel title="CrewCard" subtitle="Sample crew.json · click to toggle selection">
        <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
          {crew.map((m) => (
            <CrewCard
              key={m.id}
              member={m}
              selected={picked.includes(m.id)}
              onSelect={() => toggle(m.id)}
            />
          ))}
        </div>
      </Panel>

      <Panel title="PartCard" subtitle="Sample parts.json · click to toggle selection">
        <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
          {parts.map((p) => (
            <PartCard
              key={p.id}
              part={p}
              selected={picked.includes(p.id)}
              onSelect={() => toggle(p.id)}
            />
          ))}
        </div>
      </Panel>
    </>
  )
}
