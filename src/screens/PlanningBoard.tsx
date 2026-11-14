import { PhaseShell } from '@/ui/PhaseShell'
import { EngineDebug } from './planning/EngineDebug'
import { SimulatePanel } from './planning/SimulatePanel'

export default function PlanningBoard() {
  return (
    <PhaseShell
      title="Planning Board"
      description="Pick parts and a rocket. Live mass, power and money bars show margins; teammates argue for their priorities."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">Gameplay for this phase has not been built yet.</p>
        <EngineDebug />
        <SimulatePanel />
      </div>
    </PhaseShell>
  )
}
