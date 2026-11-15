import { useEffect, useRef, useState } from 'react'
import { offerTip } from '@/nova/tips'
import { canEdit, ownerOfChange } from '@/engine/planning'
import { launchReadiness, planningGauges, roleUsage } from '@/engine/planningHints'
import { playerRoleOf } from '@/engine/recruitment'
import type { CrewMember, Role } from '@/schemas'
import { useStore } from '@/store'
import { emitConcept } from '@/store/concepts'
import { Button } from '@/ui/Button'
import { Collapsible } from '@/ui/Collapsible'
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
/** How long a panel reached from the Launch Check stays highlighted, in ms. */
const FLASH_MS = 2500

export default function PlanningBoard() {
  const p = usePlanning()
  const setPhase = useStore((s) => s.setPhase)
  const prevPhase = useStore((s) => s.prevPhase)
  const nextPhase = useStore((s) => s.nextPhase)
  const recordTrade = useStore((s) => s.recordTrade)
  const setStandingOrders = useStore((s) => s.setStandingOrders)
  const [talkTo, setTalkTo] = useState<CrewMember | null>(null)
  const latest = useRef(p)
  useEffect(() => {
    latest.current = p
  })

  // "Fix in Planning": scroll to and focus the panel the Launch Check pointed at.
  const focusPanel = useUi((s) => s.focusPanel)
  const ready = p.design !== null
  useEffect(() => {
    if (!focusPanel || !ready) return
    const el = document.getElementById(focusPanel)
    if (el) {
      el.scrollIntoView({ block: 'start' })
      el.focus({ preventScroll: true })
      el.setAttribute('data-flash', '')
      setTimeout(() => el.removeAttribute('data-flash'), FLASH_MS)
    }
    useUi.getState().setFocusPanel(null)
  }, [focusPanel, ready])

  const massStatus = p.design
    ? planningGauges(p.design, p.content).find((g) => g.id === 'mass')?.status
    : undefined
  useEffect(() => {
    if (massStatus === 'fail') {
      emitConcept('mass_budget')
      offerTip('planning-over-limit')
    }
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
      fill
    >
      <div
        className="grid min-h-0 flex-1 grid-cols-[32fr_40fr_28fr] gap-3"
        data-testid="planning-board"
      >
        {/* LEFT: parts, supplies, launcher. Scrolls by itself only if needed. */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto pr-1">
          <Panel
            id="panel-catalog"
            testId="catalog-panel"
            title="Parts"
            subtitle="Add (+), remove (−) or swap (⇄) parts in your seat. Parts owned by a teammate need a trade: talk to them."
            padded={false}
          >
            <div className="min-w-0 px-3 pb-3">
              <PartsCatalog
                design={design}
                seat={seat}
                content={content}
                ownerName={ownerName}
                onEdit={p.edit}
              />
            </div>
          </Panel>
          <Collapsible id="panel-supplies" testId="supplies-panel" title="Supplies">
            <SuppliesPanel
              design={design}
              seat={seat}
              content={content}
              ownerName={ownerName(
                ownerOfChange({ kind: 'supply', resource: 'waterKg', deltaKg: 0 }, content),
              )}
              onEdit={p.edit}
            />
          </Collapsible>
          <Collapsible id="panel-launcher" testId="launcher-panel" title="Launcher">
            <RocketSelector
              design={design}
              seat={seat}
              content={content}
              ownerName={ownerName(ownerOfChange({ kind: 'rocket', rocketId: '' }, content))}
              onEdit={p.edit}
            />
          </Collapsible>
          {isMars && (
            <Collapsible id="panel-orders" testId="standing-orders-panel" title="Standing orders">
              <StandingOrdersPanel orders={design.standingOrders} onChange={setStandingOrders} />
            </Collapsible>
          )}
        </div>

        {/* CENTRE: the team in one row, then the base picture filling the rest. */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <TeamColumn
            seat={seat}
            seatName={seatName}
            callsign={p.callsign}
            team={team}
            usage={(role) => roleUsage(design, role, content)}
            playerUsage={playerUsage}
            onOpen={playerRole ? setTalkTo : null}
          />
          <BaseView design={design} seat={seat} content={content} />
        </div>

        {/* RIGHT: resources and fixes, with the main button always at the bottom. */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
            <MarginsColumn
              design={design}
              content={content}
              hintsEnabled={content.constants.difficulty[p.difficulty].hintsEnabled}
              ownerName={ownerName}
              canApply={(s) => canEdit(seat, s.change, content)}
              onApply={(s) => p.edit(s.change)}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t-2 border-border pt-3">
            {readiness.fails + readiness.warns > 0 && (
              <p className="text-xs text-alert" id="next-hint">
                {readiness.fails} failing, {readiness.warns} warning checks: you can still confirm.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={prevPhase} data-testid="back-button">
                ← Back
              </Button>
              <Button
                className="min-w-0 flex-1"
                onClick={nextPhase}
                data-testid="next-button"
                aria-describedby={readiness.fails + readiness.warns > 0 ? 'next-hint' : undefined}
              >
                Confirm plan
              </Button>
            </div>
          </div>
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
