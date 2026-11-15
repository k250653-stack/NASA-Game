import { useRef, type KeyboardEvent } from 'react'
import { playSound } from './sound'

export interface SegmentOption<T extends string> {
  id: T
  label: string
  /** Shown under the control for the selected option. */
  description?: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** Radio group drawn as joined buttons. Arrow keys move the selection. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  )
  const selected = options[index]

  const move = (e: KeyboardEvent, i: number) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + options.length) % options.length
    const option = options[next]
    if (option) onChange(option.id)
    refs.current[next]?.focus()
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex max-w-full flex-wrap rounded-md border border-border-strong bg-surface p-1"
      >
        {options.map((o, i) => {
          const checked = o.id === value
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => {
                playSound('click')
                onChange(o.id)
              }}
              onKeyDown={(e) => move(e, i)}
              className={`rounded-sm px-3 py-1.5 font-display text-sm font-semibold transition-colors ${
                checked ? 'bg-accent text-on-accent' : 'text-muted hover:text-primary'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {selected?.description && <p className="mt-2 text-sm text-muted">{selected.description}</p>}
    </div>
  )
}
