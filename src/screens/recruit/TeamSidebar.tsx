import type { TeamValidation } from '@/engine/recruitment'
import type { TeamAnalysis } from '@/engine/teamBalance'
import type { CrewMember, RoleChoice } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { ROLE_LABEL } from '@/ui/labels'
import { Panel } from '@/ui/Panel'
import { ResourceBar } from '@/ui/ResourceBar'
import { roleClasses } from '@/ui/roleColors'
import { StatChip } from '@/ui/StatChip'

interface TeamSidebarProps {
  roleChoice: RoleChoice
  callsign: string
  seatName: string
  team: CrewMember[]
  validation: TeamValidation
  analysis: TeamAnalysis
  onOpen: (id: string) => void
  onSuggest: () => void
  canSuggest: boolean
}

/** "Your team" seats, salaries vs budget, and the live Team Balance panel. */
export function TeamSidebar(p: TeamSidebarProps) {
  const v = p.validation
  // Seats: one per required role, or free seats for the Mission Director.
  const seats = v.requiredRoles.length
    ? v.requiredRoles.map((role) => ({
        key: role,
        label: ROLE_LABEL[role],
        member: p.team.find((m) => m.role === role),
      }))
    : Array.from({ length: v.slots }, (_, i) => ({
        key: String(i),
        label: `Seat ${i + 2}`,
        member: p.team[i],
      }))

  return (
    <>
      <Panel title="Your team" subtitle={`${p.team.length + 1} of ${v.slots + 1} seats`}>
        <ul className="flex flex-col gap-2">
          <li
            className={`flex items-center gap-2 border-2 px-2 py-1.5 ${roleClasses(p.roleChoice).border} ${roleClasses(p.roleChoice).bg}`}
          >
            <Icon name="IconUser" size={18} className={roleClasses(p.roleChoice).text} />
            <span className="text-sm font-medium text-primary">{p.callsign || 'You'}</span>
            <span className="ml-auto text-xs text-muted">{p.seatName}</span>
          </li>
          {seats.map((seat) => (
            <li key={seat.key}>
              {seat.member ? (
                <button
                  type="button"
                  onClick={() => p.onOpen(seat.member!.id)}
                  className="flex w-full items-center gap-2 border-2 border-border px-2 py-1.5 text-left hover:border-border-strong"
                >
                  <AssetImage
                    kind="portraits"
                    id={seat.member.portrait}
                    label={seat.member.name}
                    className="size-7 rounded-sm"
                  />
                  <span className="text-sm text-primary">{seat.member.name}</span>
                  <span className="ml-auto text-xs text-muted">{seat.label}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 border-2 border-dashed border-border px-2 py-2 text-sm text-subtle">
                  Empty: {seat.label}
                </div>
              )}
            </li>
          ))}
        </ul>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          size="sm"
          onClick={p.onSuggest}
          data-testid="suggest-team-button"
          disabled={!p.canSuggest}
        >
          Suggested team
        </Button>

        <h3 className="label-caps mt-4 border-t-2 border-border pt-3 text-sm text-muted">Budget</h3>
        <div className="mt-2 flex flex-col gap-3">
          <StatChip
            testId="salaries"
            icon="IconCoin"
            label="Salaries"
            value={`$${v.salaryM}`}
            unit="M"
            tone={v.remainingM < 0 ? 'danger' : 'neutral'}
          />
          <ResourceBar
            label="For hardware"
            icon="IconCoin"
            value={Math.max(0, v.remainingM)}
            max={v.budgetM}
            unit="$M"
          />
        </div>

        <h3 className="label-caps mt-4 border-t-2 border-border pt-3 text-sm text-muted">
          Team balance
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant={p.analysis.hasThinker ? 'thinker' : 'neutral'}>
            {p.analysis.hasThinker ? 'Thinker ✓' : 'No Thinker'}
          </Badge>
          <Badge variant={p.analysis.hasPractical ? 'practical' : 'neutral'}>
            {p.analysis.hasPractical ? 'Practical ✓' : 'No Practical'}
          </Badge>
          <Badge variant={p.analysis.leaderCount === 1 ? 'leader' : 'warning'}>
            {p.analysis.leaderCount} Leader{p.analysis.leaderCount === 1 ? '' : 's'}
          </Badge>
        </div>
        {p.team.length > 0 && p.analysis.warnings.length > 0 ? (
          <ul
            className="mt-3 flex flex-col gap-2"
            aria-live="polite"
            data-testid="balance-warnings"
          >
            {p.analysis.warnings.map((w) => (
              <li key={w} className="flex gap-2 text-sm text-alert">
                <Icon name="IconAlertTriangle" size={16} className="mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        ) : (
          p.team.length > 0 && (
            <p className="mt-3 text-sm text-success">Balanced team: no penalties.</p>
          )
        )}
      </Panel>
    </>
  )
}
