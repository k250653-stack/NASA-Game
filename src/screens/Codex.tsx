import { CodexList } from '@/nova/NovaCodex'
import { Panel } from '@/ui/Panel'
import { PhaseShell } from '@/ui/PhaseShell'

/** Library of every NOVA lesson: unlocked ones can be replayed, the rest are locked. */
export default function Codex() {
  return (
    <PhaseShell
      title="Codex"
      description="Every NOVA lesson you have unlocked, with its visual, formula and source."
    >
      <Panel title="NOVA's notes">
        <CodexList />
      </Panel>
    </PhaseShell>
  )
}
