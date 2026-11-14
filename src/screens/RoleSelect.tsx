import { getContent } from '@/content/load'
import { CALLSIGN_MAX_LENGTH as CALLSIGN_MAX, validateCallsign } from '@/engine/recruitment'
import { useStore } from '@/store'
import { Panel } from '@/ui/Panel'
import { PhaseShell } from '@/ui/PhaseShell'
import { RoleCard } from './role/RoleCard'

export default function RoleSelect() {
  const roles = getContent().roles
  const roleChoice = useStore((s) => s.game.roleChoice)
  const setRoleChoice = useStore((s) => s.setRoleChoice)
  const callsign = useStore((s) => s.game.callsign)
  const setCallsign = useStore((s) => s.setCallsign)
  const check = validateCallsign(callsign)
  const hint = !roleChoice ? 'Pick your seat to continue.' : !check.ok ? check.reason : undefined

  return (
    <PhaseShell
      title="Choose Your Role"
      description="Pick the seat you fly. AI teammates run the other systems and answer their own events; the Mission Director runs everything alone."
      nextLabel="Continue"
      nextDisabled={hint !== undefined}
      nextHint={hint}
    >
      <Panel
        title="Callsign"
        subtitle="Shown on the mission screens. Leave empty to be called “You”."
      >
        <div className="flex items-center gap-3">
          <input
            id="callsign"
            value={callsign}
            maxLength={CALLSIGN_MAX}
            placeholder="You"
            aria-label="Callsign"
            aria-invalid={!check.ok}
            aria-describedby="callsign-help"
            onChange={(e) => setCallsign(e.target.value)}
            className="h-10 w-64 rounded-md border border-border-strong bg-surface px-3 font-mono text-primary placeholder:text-subtle"
          />
          <span
            id="callsign-help"
            className={`text-sm ${check.ok ? 'text-subtle' : 'text-danger'}`}
          >
            {check.ok ? `${callsign.length} / ${CALLSIGN_MAX}` : check.reason}
          </span>
        </div>
      </Panel>
      <div className="grid grid-cols-3 gap-4 2xl:grid-cols-5">
        {roles.map((r) => (
          <RoleCard
            key={r.id}
            role={r}
            selected={r.id === roleChoice}
            onSelect={() => setRoleChoice(r.id)}
          />
        ))}
      </div>
    </PhaseShell>
  )
}
