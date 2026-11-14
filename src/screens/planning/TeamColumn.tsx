import type { RoleUsage } from '@/engine/planningHints'
import type { CrewMember, RoleChoice } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { ROLE_LABEL } from '@/ui/labels'
import { Panel } from '@/ui/Panel'
import { roleClasses } from '@/ui/roleColors'

interface TeamColumnProps {
  seat: RoleChoice
  seatName: string
  callsign: string
  team: CrewMember[]
  usage: (role: CrewMember['role']) => RoleUsage
  /** Seat usage for the player (all items for the Mission Director). */
  playerUsage: RoleUsage
  /** null for the Mission Director (no AI teammates to negotiate with). */
  onOpen: ((member: CrewMember) => void) | null
}

function UsageLine({ u }: { u: RoleUsage }) {
  return (
    <p className="mt-1 font-mono text-[11px] text-muted tabular-nums">
      {Math.round(u.massKg).toLocaleString('en-US')} kg ·{' '}
      {Math.round(u.powerW).toLocaleString('en-US')} W · ${Math.round(u.costM)}M
    </p>
  )
}

/** "Mission Team": the player and the AI teammates with what each is using. */
export function TeamColumn({
  seat,
  seatName,
  callsign,
  team,
  usage,
  playerUsage,
  onOpen,
}: TeamColumnProps) {
  return (
    <Panel title="Mission team" padded={false}>
      <ul className="flex flex-col">
        <li className={`border-b border-border border-l-4 px-3 py-2.5 ${roleClasses(seat).border}`}>
          <div className="flex items-center gap-2">
            <AssetImage
              kind="portraits"
              id="crew-player"
              label={callsign || 'You'}
              className="size-9 rounded-md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">{callsign || 'You'}</p>
              <p className={`text-xs ${roleClasses(seat).text}`}>{seatName}</p>
            </div>
          </div>
          <UsageLine u={playerUsage} />
        </li>
        {team.map((m) => {
          const c = roleClasses(m.role)
          const body = (
            <>
              <div className="flex items-center gap-2">
                <AssetImage
                  kind="portraits"
                  id={m.portrait}
                  label={m.name}
                  className="size-9 rounded-md"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">{m.name}</p>
                  <p className={`text-xs ${c.text}`}>{ROLE_LABEL[m.role]}</p>
                </div>
                {onOpen && (
                  <Badge variant="info" className="ml-auto">
                    Talk
                  </Badge>
                )}
              </div>
              <UsageLine u={usage(m.role)} />
            </>
          )
          return (
            <li
              key={m.id}
              className={`border-b border-border border-l-4 last:border-b-0 ${c.border}`}
            >
              {onOpen ? (
                <button
                  type="button"
                  data-testid={`teammate-card-${m.id}`}
                  onClick={() => onOpen(m)}
                  className="w-full px-3 py-2.5 text-left hover:bg-panel-raised"
                >
                  {body}
                </button>
              ) : (
                <div className="px-3 py-2.5">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
