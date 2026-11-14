import { PhaseShell } from '@/ui/PhaseShell'
import { CrewCard } from '@/ui/CrewCard'
import { getContent } from '@/content/load'
import { useStore } from '@/store'

export default function Recruit() {
  const crew = getContent().crew
  const recruitedIds = useStore((s) => s.crew.recruitedIds)
  const recruit = useStore((s) => s.recruit)
  const dismiss = useStore((s) => s.dismiss)

  return (
    <PhaseShell
      title="Recruit Your Crew"
      description="Hire teammates from crew.json. Balance Thinker / Practical / Leader traits and cover every role within budget."
    >
      <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
        {crew.map((member) => {
          const selected = recruitedIds.includes(member.id)
          return (
            <CrewCard
              key={member.id}
              member={member}
              selected={selected}
              onSelect={() => (selected ? dismiss(member.id) : recruit(member.id))}
            />
          )
        })}
      </div>
    </PhaseShell>
  )
}
