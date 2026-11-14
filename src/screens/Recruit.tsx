import { useState } from 'react'
import { getContent } from '@/content/load'
import { suggestTeam } from '@/engine/crewAI'
import {
  candidates,
  recruitCandidate,
  teamAnalysis,
  validateTeam,
  type TeamDraft,
} from '@/engine/recruitment'
import { useStore } from '@/store'
import { Button } from '@/ui/Button'
import { CrewCard } from '@/ui/CrewCard'
import { Panel } from '@/ui/Panel'
import { PhaseShell } from '@/ui/PhaseShell'
import { toast } from '@/ui/uiStore'
import { CrewDetailModal } from './recruit/CrewDetailModal'
import { TeamSidebar } from './recruit/TeamSidebar'

export default function Recruit() {
  const content = getContent()
  const scenarioId = useStore((s) => s.game.scenarioId)
  const roleChoice = useStore((s) => s.game.roleChoice)
  const difficulty = useStore((s) => s.game.difficulty)
  const callsign = useStore((s) => s.game.callsign)
  const recruitedIds = useStore((s) => s.crew.recruitedIds)
  const setRecruited = useStore((s) => s.setRecruited)
  const dismiss = useStore((s) => s.dismiss)
  const setPhase = useStore((s) => s.setPhase)
  const [openId, setOpenId] = useState<string | null>(null)

  if (!scenarioId || !roleChoice) {
    return (
      <PhaseShell
        title="Recruit Your Crew"
        description="Hire the people who fly with you."
        nextDisabled
        nextHint="Choose a scenario and a role first."
      >
        <Panel title="Not ready yet">
          <p className="text-muted">
            Recruitment needs a scenario (for crew size and budget) and your role.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => setPhase(scenarioId ? 'role' : 'scenario')}
          >
            ← {scenarioId ? 'Choose role' : 'Choose scenario'}
          </Button>
        </Panel>
      </PhaseShell>
    )
  }

  const draft: TeamDraft = { scenarioId, difficulty, roleChoice, crewIds: recruitedIds }
  const validation = validateTeam(draft, content)
  const analysis = teamAnalysis(draft, content)
  const pool = candidates(content)
  const team = pool.filter((m) => recruitedIds.includes(m.id))
  const seatName = content.roles.find((r) => r.id === roleChoice)?.name ?? roleChoice
  const suggestion = suggestTeam(draft, content)

  const open = pool.find((m) => m.id === openId) ?? null
  const preview = open ? recruitCandidate(draft, open.id, content) : null
  const replaces = preview?.replacedId
    ? pool.find((m) => m.id === preview.replacedId)?.name
    : undefined

  const recruit = () => {
    if (!preview || preview.refused) return
    setRecruited(preview.crewIds)
    setOpenId(null)
  }

  return (
    <PhaseShell
      title="Recruit Your Crew"
      description="Click a candidate to read their file. Cover every role except yours, keep the team balanced, and stay inside the budget."
      nextLabel="Continue to Planning"
      nextDisabled={!validation.valid}
      nextHint={validation.reasons[0]}
      sidebar={
        <TeamSidebar
          roleChoice={roleChoice}
          callsign={callsign}
          seatName={seatName}
          team={team}
          validation={validation}
          analysis={analysis}
          onOpen={setOpenId}
          canSuggest={suggestion !== null}
          onSuggest={() => {
            if (!suggestion) return
            setRecruited(suggestion)
            toast.success(
              'Suggested team recruited',
              'Balanced, every role covered, within budget.',
            )
          }}
        />
      }
    >
      <div className="grid grid-cols-2 gap-4 2xl:grid-cols-3">
        {pool.map((m) => (
          <CrewCard
            key={m.id}
            member={m}
            selected={recruitedIds.includes(m.id)}
            onSelect={() => setOpenId(m.id)}
          />
        ))}
      </div>
      <CrewDetailModal
        member={open}
        recruited={open ? recruitedIds.includes(open.id) : false}
        blockedReason={preview?.refused}
        replaces={replaces}
        onRecruit={recruit}
        onRemove={() => {
          if (open) dismiss(open.id)
          setOpenId(null)
        }}
        onClose={() => setOpenId(null)}
      />
    </PhaseShell>
  )
}
