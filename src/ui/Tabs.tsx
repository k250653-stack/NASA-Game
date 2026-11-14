import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'

export interface TabItem {
  id: string
  label: ReactNode
  content: ReactNode
}

interface TabsProps {
  tabs: readonly TabItem[]
  defaultId?: string
}

/** Accessible tabs: Left/Right/Home/End move between tabs. */
export function Tabs({ tabs, defaultId }: TabsProps) {
  const base = useId()
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id ?? '')
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0]

  const onKey = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const target =
      e.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : e.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (target === null) return
    e.preventDefault()
    const tab = tabs[target]
    if (tab) setActive(tab.id)
    refs.current[target]?.focus()
  }

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-border">
        {tabs.map((t, i) => {
          const selected = t.id === activeTab?.id
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`relative px-4 py-2 font-display text-sm font-medium transition-colors ${
                selected ? 'text-accent' : 'text-muted hover:text-primary'
              }`}
            >
              {t.label}
              {selected && (
                <motion.span
                  layoutId={`${base}-underline`}
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                />
              )}
            </button>
          )
        })}
      </div>
      {activeTab && (
        <div
          role="tabpanel"
          id={`${base}-panel-${activeTab.id}`}
          aria-labelledby={`${base}-tab-${activeTab.id}`}
          tabIndex={0}
          className="pt-4"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  )
}
