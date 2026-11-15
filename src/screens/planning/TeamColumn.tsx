import type { RoleUsage } from '@/engine/planningHints'
import type { CrewMember, RoleChoice } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { ROLE_LABEL } from '@/ui/labels'
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

function usageText(u: RoleUsage): string {
  const kg = Math.round(u.massKg).toLocaleString('en-US')
  const w = Math.round(u.powerW).toLocaleString('en-US')
  return `${kg} kg · ${w} W · $${Math.round(u.costM)}M`
}

/** The mission team as a row of portraits; click a teammate to negotiate. Usage on hover. */
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
    <ul className="flex flex-wrap items-end gap-4" aria-label="Mission team">
      <li
        title={`${seatName}: ${usageText(playerUsage)}`}
        className="flex flex-col items-center gap-1"
      >
        <AssetImage
          kind="portraits"
          id="crew-player"
          label={callsign || 'You'}
          className={`size-16 border-2 ${roleClasses(seat).border}`}
        />
        <span className="label-caps text-xs text-primary">{callsign || 'You'}</span>
        <span className={`label-caps text-xs ${roleClasses(seat).text}`}>{seatName}</span>
      </li>
      {team.map((m) => {
        const c = roleClasses(m.role)
        const tip = `${m.name}, ${ROLE_LABEL[m.role]}: ${usageText(usage(m.role))}${onOpen ? '. Click to negotiate.' : ''}`
        const body = (
          <>
            <AssetImage
              kind="portraits"
              id={m.portrait}
              label={m.name}
              className={`size-16 border-2 ${c.border}`}
            />
            <span className="label-caps text-xs text-primary">{m.name.split(' ')[0]}</span>
            <span className={`label-caps text-xs ${c.text}`}>{ROLE_LABEL[m.role]}</span>
          </>
        )
        return (
          <li key={m.id}>
            {onOpen ? (
              <button
                type="button"
                title={tip}
                data-testid={`teammate-card-${m.id}`}
                onClick={() => onOpen(m)}
                className="flex flex-col items-center gap-1 transition-transform hover:-translate-y-px"
              >
                {body}
              </button>
            ) : (
              <div title={tip} className="flex flex-col items-center gap-1">
                {body}
              </div>
            )}
          </li>
        )
      })}
      {onOpen && (
        <li className="label-caps self-center text-xs text-subtle">Click a teammate to trade</li>
      )}
    </ul>
  )
}
