import { useEffect, useRef, type KeyboardEvent } from 'react'
import { playSound } from '@/ui/sound'

export interface MenuItem {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  /** Tooltip, e.g. why an item is disabled. */
  hint?: string
}

/**
 * Vertical text menu. Hover and keyboard focus are the same thing (hovering focuses the item),
 * so only one item is ever highlighted. Arrow keys move between enabled items; Enter selects.
 */
export function MenuList({ items }: { items: MenuItem[] }) {
  const listRef = useRef<HTMLDivElement>(null)

  const buttons = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])

  // Focus the first item so Enter / arrow keys work straight away.
  useEffect(() => {
    buttons()[0]?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const list = buttons()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    const next = i === -1 ? 0 : (i + step + list.length) % list.length
    list[next]?.focus()
  }

  return (
    <div ref={listRef} role="menu" onKeyDown={onKeyDown} className="flex flex-col items-start">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          data-testid={item.id}
          disabled={item.disabled}
          title={item.hint}
          onClick={() => {
            playSound('click')
            item.onSelect()
          }}
          onMouseEnter={(e) => {
            if (document.activeElement !== e.currentTarget) playSound('hover')
            e.currentTarget.focus()
          }}
          className="group flex items-center gap-3 py-2 font-title text-base tracking-[0.35em] text-muted uppercase transition-colors duration-200 outline-none focus:text-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:text-subtle/50"
        >
          <span
            aria-hidden
            className="w-4 -translate-x-2 text-primary opacity-0 transition-all duration-200 group-focus:translate-x-0 group-focus:opacity-100 motion-reduce:transition-none"
          >
            →
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
