import type { RoleUsage } from '@/engine/planningHints'
import type { CrewMember, RoleChoice } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { compactNumber } from '@/ui/compactNumber'
import { PlayerPortrait } from '@/ui/PlayerPortrait'
import { Icon } from '@/ui/Icon'
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

/** Short role names so they fit a narrow card. */
const SHORT_ROLE: Record<CrewMember['role'], string> = {
  science: 'Science',
  power_life: 'Power & Life',
  comms_nav: 'Comms & Nav',
  launch_budget: 'Launch & Budget',
}

function usageText(u: RoleUsage): string {
  return `${compactNumber(u.massKg)} kg · ${compactNumber(u.powerW)} W · $${Math.round(u.costM)}M`
}

/** The whole team in ONE row of four compact cards; the talk icon on a teammate opens a trade. */
export function TeamColumn({
  seat,
  seatName,
  callsign,
  team,
  usage,
  playerUsage,
  onOpen,
}: TeamColumnProps) {
  const card = 'relative flex min-w-0 flex-col items-center gap-1 border-2 bg-panel p-1.5 text-center'
  return (
    <ul className="grid min-w-0 shrink-0 grid-cols-4 gap-2" aria-label="Mission team">
      <li
        title={`${seatName}: ${usageText(playerUsage)}`}
        className={`${card} ${roleClasses(seat).border}`}
      >
        <PlayerPortrait size={56} className={`border-2 ${roleClasses(seat).border}`} />
        <p className="label-caps w-full truncate text-xs text-primary">{callsign || 'You'}</p>
        <p className={`label-caps w-full truncate text-xs ${roleClasses(seat).text}`}>
          {seat === 'director' ? 'Director' : seatName}
        </p>
      </li>
      {team.map((m) => {
        const c = roleClasses(m.role)
        return (
          <li
            key={m.id}
            title={`${m.name}, ${SHORT_ROLE[m.role]}: ${usageText(usage(m.role))}`}
            data-testid={`teammate-card-${m.id}`}
            className={`${card} ${c.border}`}
          >
            <AssetImage
              kind="portraits"
              id={m.portrait}
              label={m.name}
              className={`size-14 shrink-0 border-2 ${c.border}`}
            />
            <p className="label-caps w-full truncate text-xs text-primary">{m.name.split(' ')[0]}</p>
            <p className={`label-caps w-full truncate text-xs ${c.text}`}>{SHORT_ROLE[m.role]}</p>
            {onOpen && (
              <button
                type="button"
                title={`Talk to ${m.name.split(' ')[0]} to trade parts and budget`}
                aria-label={`Talk to ${m.name}`}
                data-testid={`talk-${m.id}`}
                onClick={() => onOpen(m)}
                className="absolute top-1 right-1 flex size-6 items-center justify-center border-2 border-border-strong bg-bg/80 text-muted hover:border-accent hover:text-accent"
              >
                <Icon name="IconBubble" size={14} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
