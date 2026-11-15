import { useEffect, useState } from 'react'
import { offerTip } from '@/nova/tips'
import { goNoGoPoll, overallCall } from '@/engine/launchPoll'
import { runLaunchCheck } from '@/engine/launchCheck'
import { initMission } from '@/engine/mission'
import type { CheckId } from '@/engine/types'
import { useStore } from '@/store'
import { emitConcept } from '@/store/concepts'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { Panel } from '@/ui/Panel'
import { PhaseShell } from '@/ui/PhaseShell'
import { useUi } from '@/ui/uiStore'
import { FIX_TARGET } from './launch/fixTargets'
import { LaunchChecklist } from './launch/LaunchChecklist'
import { LaunchSequence } from './launch/LaunchSequence'
import { PollPanel } from './launch/PollPanel'
import { usePlanning } from './planning/usePlanning'

export default function LaunchCheck() {
  const p = usePlanning()
  const setPhase = useStore((s) => s.setPhase)
  const setRun = useStore((s) => s.setRun)
  const seed = useStore((s) => s.game.seed)
  const setFocusPanel = useUi((s) => s.setFocusPanel)
  const [confirm, setConfirm] = useState(false)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    emitConcept('go_no_go_poll')
    offerTip('launch-check')
  }, [])

  if (!p.design || !p.destination) {
    return (
      <PhaseShell
        title="Launch Check"
        description="Go / no-go review."
        nextDisabled
        nextHint="Design the mission first."
      >
        <Panel title="Not ready yet">
          <p className="text-muted">The Launch Check needs a design from the Planning Board.</p>
          <Button className="mt-3" variant="secondary" onClick={() => setPhase('planning')}>
            ← Planning Board
          </Button>
        </Panel>
      </PhaseShell>
    )
  }

  const design = p.design
  const checks = runLaunchCheck(design, p.content)
  const lines = goNoGoPoll(checks, design, p.content)
  const call = overallCall(checks, lines)
  const fails = checks.filter((c) => c.status === 'fail')
  const risks = [
    ...checks.filter((c) => c.status === 'warn').map((c) => c.explanation),
    ...lines
      .filter((l) => l.verdict === 'go-with-concerns' && l.checkIds.length === 0)
      .map((l) => l.reason),
  ]
  const rocket = p.content.rockets.find((r) => r.id === design.rocketId)

  const fix = (id: CheckId) => {
    const target = FIX_TARGET[id]
    setFocusPanel(target.panel ?? null)
    setPhase(target.phase)
  }
  const launch = () => {
    setConfirm(false)
    setLaunching(true)
  }
  const arrive = () => {
    setRun(initMission(design, p.content, seed))
    setPhase('mission')
  }

  return (
    <PhaseShell
      title="Launch Check"
      description="The flight director polls every seat. Failing checks block launch; warnings need your confirmation."
      nextLabel="Launch"
      nextDisabled={call === 'NO-GO' || !rocket}
      nextHint={
        call === 'NO-GO'
          ? `No-go: ${fails[0]?.explanation ?? 'fix the failing checks.'}`
          : undefined
      }
      onNext={() => (call === 'GO WITH RISKS' ? setConfirm(true) : launch())}
    >
      <div
        className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5"
        data-testid="launch-check"
      >
        <LaunchChecklist checks={checks} onFix={fix} />
        <PollPanel lines={lines} call={call} crew={p.team} callsign={p.callsign} />
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Launch with known risks?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Back to the checklist
            </Button>
            <Button variant="danger" onClick={launch} data-testid="confirm-launch">
              Launch anyway
            </Button>
          </>
        }
      >
        <ul className="list-inside list-disc space-y-1 text-sm text-muted" data-testid="risk-list">
          {risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Modal>
      {launching && rocket && (
        <LaunchSequence rocket={rocket} destination={p.destination} onDone={arrive} />
      )}
    </PhaseShell>
  )
}
