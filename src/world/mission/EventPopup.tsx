import { useEffect, useState } from 'react'
import { playSound } from '@/ui/sound'
import {
  availableOptions,
  eligibleCrew,
  needsCrew,
  successChance,
  type OptionAvailability,
} from '@/engine/events'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { CrewMember, GameEvent } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { ROLE_LABEL } from '@/ui/labels'
import { PopupPanel } from '../PopupPanel'

interface EventPopupProps {
  event: GameEvent
  run: MissionState
  design: Design
  content: EngineContent
  onChoose: (optionId: string, crewId: string | null) => void
  /** Offered on repair-type events with a hands-on task (content/tasks.json). */
  diy?: { label: string; station: string; onPick: () => void }
}

/** An event for the player's seat: what happened, and every option with who, cost and odds. */
export function EventPopup({ event, run, design, content, onChoose, diy }: EventPopupProps) {
  const options = availableOptions(run, event, design, content)
  // Urgent events sound the alarm; routine ones come in over the radio.
  const urgent = event.urgency === 'urgent'
  useEffect(() => playSound(urgent ? 'alarm' : 'radio'), [event.id, urgent])
  return (
    <PopupPanel section="Event" title={event.title}>
      <div className="mx-auto max-w-4xl px-6 py-6" data-testid="event-popup" data-event={event.id}>
        <AssetImage
          kind="events"
          id={`event-${event.id}`}
          label={event.title}
          className="mx-auto mb-4 block h-[240px] w-[480px] border-2 border-border-strong"
        />
        <div className="flex gap-6">
          <div className="min-w-0">
            <p className="font-title text-xs tracking-widest text-alert uppercase">
              {ROLE_LABEL[event.role]} · {event.urgency}
            </p>
            <p className="mt-2 text-base text-primary">{event.description}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {diy && (
            <li
              className="flex items-center gap-3 border-2 border-alert px-3 py-2"
              data-testid="option-diy"
            >
              <div className="min-w-0 flex-1">
                <p className="label-caps text-lg text-alert">Do it yourself</p>
                <p className="font-mono text-xs text-muted">
                  {diy.label} at the {diy.station} · finish in time for a better chance
                </p>
              </div>
              <button
                type="button"
                onClick={diy.onPick}
                className="border-2 border-alert bg-alert px-3 py-1 font-display tracking-widest text-on-alert uppercase hover:bg-alert-strong"
                data-testid="choose-diy"
              >
                Go
              </button>
            </li>
          )}
          {options.map((a) => (
            <OptionRow
              key={a.option.id}
              a={a}
              event={event}
              run={run}
              design={design}
              content={content}
              onChoose={onChoose}
            />
          ))}
        </ul>
      </div>
    </PopupPanel>
  )
}

interface OptionRowProps extends Omit<EventPopupProps, 'event'> {
  a: OptionAvailability
  event: GameEvent
}

function OptionRow({ a, event, run, design, content, onChoose }: OptionRowProps) {
  const ctx = { design, content }
  const { option } = a
  const crew = needsCrew(option) ? eligibleCrew(run, option, ctx) : []
  const best = [...crew].sort(
    (x, y) => successChance(run, event, option, y, ctx) - successChance(run, event, option, x, ctx),
  )[0]
  const [pickedId, setPickedId] = useState<string | null>(best?.id ?? null)
  const picked: CrewMember | null = crew.find((m) => m.id === pickedId) ?? best ?? null
  const chance = successChance(run, event, option, picked, ctx)
  const c = option.consumes
  const costs = [
    c.suits ? `${c.suits} suit` : null,
    c.spareKits ? `${c.spareKits} spare kit` : null,
    c.rationDays ? `${c.rationDays} ration days` : null,
    c.powerWh ? `${c.powerWh.toLocaleString('en-US')} Wh` : null,
    c.crewEnergy ? `${c.crewEnergy} energy` : null,
  ].filter(Boolean)

  return (
    <li
      className={`border px-3 py-2 ${a.available ? 'border-border-strong' : 'border-border'}`}
      data-testid={`option-${option.id}`}
      data-available={a.available}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`font-title text-lg tracking-wide uppercase ${a.available ? 'text-primary' : 'text-subtle'}`}
          >
            {option.label}
          </p>
          <p className="font-mono text-xs text-muted">
            Cost: {costs.length ? costs.join(' · ') : 'nothing'}
            {a.available && (
              <>
                {' '}
                · Success{' '}
                <span className="text-accent tabular-nums">{Math.round(chance * 100)}%</span>
              </>
            )}
          </p>
          {!a.available && <p className="text-xs text-danger">{a.reason}</p>}
        </div>
        <button
          type="button"
          disabled={!a.available}
          onClick={() => onChoose(option.id, needsCrew(option) ? (picked?.id ?? null) : null)}
          className="border border-accent px-3 py-1 font-title tracking-widest text-accent uppercase hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-border disabled:text-subtle"
          data-testid={`choose-${option.id}`}
        >
          Do it
        </button>
      </div>
      {a.available && crew.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Who does it">
          {crew.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={m.id === picked?.id}
              onClick={() => setPickedId(m.id)}
              className={`border px-2 py-0.5 font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent ${m.id === picked?.id ? 'border-alert text-alert' : 'border-border text-muted hover:text-primary'}`}
            >
              {m.name} ·{' '}
              <span className="tabular-nums">{Math.round(run.crew[m.id]?.energy ?? 0)}</span> energy
            </button>
          ))}
        </div>
      )}
    </li>
  )
}
