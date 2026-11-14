import { getContent } from '@/content/load'
import {
  availableOptions,
  eligibleCrew,
  needsCrew,
  resolveEvent,
  successChance,
} from '@/engine/events'
import type { Rng } from '@/engine/rng'
import type { Design, MissionState } from '@/engine/types'
import type { EventOption, GameEvent } from '@/schemas'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'

interface PendingEventsProps {
  mission: MissionState
  design: Design
  rng: () => Rng
  onResolve: (s: MissionState) => void
}

/** Events waiting for the player, with every option, its availability and a button to pick it. */
export function PendingEvents({ mission, design, rng, onResolve }: PendingEventsProps) {
  const content = getContent()
  const ctx = { design, content }

  /** The eligible crew member with the best odds, or null when the option needs nobody. */
  const bestCrew = (event: GameEvent, option: EventOption) => {
    if (!needsCrew(option)) return null
    const pool = eligibleCrew(mission, option, ctx)
    return pool.reduce<(typeof pool)[number] | null>(
      (best, m) =>
        !best ||
        successChance(mission, event, option, m, ctx) >
          successChance(mission, event, option, best, ctx)
          ? m
          : best,
      null,
    )
  }

  if (mission.pendingEvents.length === 0) {
    return <p className="text-sm text-muted">No events waiting for you.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {mission.pendingEvents.map((p) => {
        const event = content.events.find((e) => e.id === p.eventId)
        if (!event) return null
        return (
          <div key={p.uid} className="rounded-md border border-alert/40 bg-alert/5 p-3">
            <div className="flex items-center gap-2">
              <Badge variant={event.urgency === 'urgent' ? 'danger' : 'info'}>
                {event.urgency}
              </Badge>
              <p className="font-medium text-primary">{event.title}</p>
              <span className="ml-auto text-xs text-subtle">day {p.day}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{event.description}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {availableOptions(mission, event, design, content).map(
                ({ option, available, reason }) => {
                  const crew = available ? bestCrew(event, option) : null
                  const chance = available ? successChance(mission, event, option, crew, ctx) : 0
                  return (
                    <li key={option.id} className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!available}
                        onClick={() =>
                          onResolve(
                            resolveEvent(mission, event, option.id, crew?.id ?? null, rng(), ctx)
                              .state,
                          )
                        }
                      >
                        {option.label}
                      </Button>
                      <span className="text-xs text-muted">
                        {available
                          ? `${crew ? `${crew.name}, ` : ''}${Math.round(chance * 100)}%`
                          : reason}
                      </span>
                    </li>
                  )
                },
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
