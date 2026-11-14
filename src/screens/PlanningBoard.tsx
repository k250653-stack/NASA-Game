import { useEffect, useRef, useState } from 'react'
import { canEdit, ownerOfChange } from '@/engine/planning'
import { launchReadiness, planningGauges, roleUsage } from '@/engine/planningHints'
import { playerRoleOf } from '@/engine/recruitment'
import type { CrewMember, Role } from '@/schemas'
import { useStore } from '@/store'
import { emitConcept } from '@/store/concepts'
import { Button } from '@/ui/Button'
import { Panel } from '@/ui/Panel'
import { PhaseShell } from '@/ui/PhaseShell'
import { useUi } from '@/ui/uiStore'
import { BaseView } from './planning/BaseView'
import { MarginsColumn } from './planning/MarginsColumn'
import { NegotiationModal } from './planning/NegotiationModal'
import { PartsCatalog } from './planning/PartsCatalog'
import { ReadinessChip } from './planning/ReadinessChip'
import { RocketSelector } from './planning/RocketSelector'
import { StandingOrdersPanel } from './planning/StandingOrdersPanel'
import { SuppliesPanel } from './planning/SuppliesPanel'
import { TeamColumn } from './planning/TeamColumn'
import { usePlanning } from './planning/usePlanning'

/** Teammates speak up at most this often when the team is over a limit, in ms. */
const REQUEST_INTERVAL_MS = 60_000

export default function PlanningBoard() {
  const p = usePlanning()
  const setPhase = useStore((s) => s.setPhase)
  const recordTrade = useStore((s) => s.recordTrade)
  const setStandingOrders = useStore((s) => s.setStandingOrders)
  const [talkTo, setTalkTo] = useState<CrewMember | null>(null)
  const latest = useRef(p)
  useEffect(() => {
    latest.current = p
  })

  const massStatus = p.design
    ? planningGauges(p.design, p.content).find((g) => g.id === 'mass')?.status
    : undefined
  useEffect(() => {
    if (massStatus === 'fail') emitConcept('mass_budget')
  }, [massStatus])

  // Unsolicited requests: a squeezed teammate speaks up, at most once a minute.
  useEffect(() => {
    let n = 0
    const timer = setInterval(() => {
      const { design, team, content } = latest.current
      if (!design || team.length === 0) return
      const over = planningGauges(design, content).some(
        (g) => (g.id === 'mass' || g.id === 'budget') && g.status === 'fail',
      )
      if (!over) return
      const who = team.find((m) => m.role === 'launch_budget') ?? team[n % team.length]!
      const lines = who.dialogue?.request ?? []
      useUi.getState().pushToast({
        kind: 'warning',
        title: `${who.name} has a request`,
        message: lines[n % Math.max(1, lines.length)] ?? 'We are over the limit.',
        // The Mission Director has no one to negotiate with, so no "View" button there.
        action:
          latest.current.seat === 'director'
            ? undefined
            : { label: 'View', onClick: () => setTalkTo(who) },
      })
      n++
    }, REQUEST_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  if (!p.design || !p.seat || !p.scenario) {
    return (
      <PhaseShell
        title="Planning Board"
        description="Design the mission with your team."
        nextDisabled
        nextHint="Recruit a crew first."
      >
        <Panel title="Not ready yet">
          <p className="text-muted">
            {p.seat
              ? 'Preparing your team’s first proposal…'
              : 'The Planning Board needs a scenario, a role and a crew.'}
          </p>
          <Button className="mt-3" variant="secondary" onClick={() => setPhase('recruit')}>
            ← Recruit crew
          </Button>
        </Panel>
      </PhaseShell>
    )
  }

  const { design, seat, content, team } = p
  const playerRole = playerRoleOf(seat)
  const readiness = launchReadiness(design, content)
  const seatName = content.roles.find((r) => r.id === seat)?.name ?? seat
  const ownerName = (role: Role) =>
    seat === 'director' || role === playerRole
      ? 'you'
      : (team.find((m) => m.role === role)?.name ??
        content.roles.find((r) => r.id === role)?.name ??
        role)
  const allUsage = (['science', 'power_life', 'comms_nav', 'launch_budget'] as const).map((r) =>
    roleUsage(design, r, content),
  )
  const playerUsage =
    seat === 'director'
      ? allUsage.reduce((a, u) => ({
          massKg: a.massKg + u.massKg,
          powerW: a.powerW + u.powerW,
          costM: a.costM + u.costM,
          partCount: a.partCount + u.partCount,
        }))
      : roleUsage(design, seat, content)
  const isMars =
    (p.destination?.signalDelayRangeSec[1] ?? 0) > content.constants.settings.delayThresholdSec

  return (
    <PhaseShell
      title="Planning Board"
      description={`Design your part of ${p.scenario.name}. Your teammates design theirs; mass, power and budget are shared.`}
      topBarExtra={<ReadinessChip readiness={readiness} />}
      nextLabel="Continue to Launch Check"
      nextHint={
        readiness.fails + readiness.warns > 0
          ? `${readiness.fails} failing and ${readiness.warns} warning checks: you can still continue.`
          : undefined
      }
      sidebar={
        <MarginsColumn
          design={design}
          content={content}
          hintsEnabled={content.constants.difficulty[p.difficulty].hintsEnabled}
          ownerName={ownerName}
          canApply={(s) => canEdit(seat, s.change, content)}
          onApply={(s) => p.edit(s.change)}
        />
      }
    >
      <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-5" data-testid="planning-board">
        <TeamColumn
          seat={seat}
          seatName={seatName}
          callsign={p.callsign}
          team={team}
          usage={(role) => roleUsage(design, role, content)}
          playerUsage={playerUsage}
          onOpen={playerRole ? setTalkTo : null}
        />
        <div className="flex min-w-0 flex-col gap-5">
          <BaseView design={design} seat={seat} content={content} />
          <Panel
            id="panel-catalog"
            testId="catalog-panel"
            title="Parts catalog"
            subtitle="Add, swap or remove parts in your seat; ask teammates for theirs."
          >
            <PartsCatalog
              design={design}
              seat={seat}
              content={content}
              ownerName={ownerName}
              onEdit={p.edit}
            />
          </Panel>
          <SuppliesPanel
            design={design}
            seat={seat}
            content={content}
            ownerName={ownerName(
              ownerOfChange({ kind: 'supply', resource: 'waterKg', deltaKg: 0 }, content),
            )}
            onEdit={p.edit}
          />
          <RocketSelector
            design={design}
            seat={seat}
            content={content}
            ownerName={ownerName(ownerOfChange({ kind: 'rocket', rocketId: '' }, content))}
            onEdit={p.edit}
          />
          {isMars && (
            <StandingOrdersPanel orders={design.standingOrders} onChange={setStandingOrders} />
          )}
        </div>
      </div>
      {playerRole && (
        <NegotiationModal
          teammate={talkTo}
          playerRole={playerRole}
          design={design}
          content={content}
          onApply={p.save}
          onRecord={recordTrade}
          onClose={() => setTalkTo(null)}
        />
      )}
    </PhaseShell>
  )
}
