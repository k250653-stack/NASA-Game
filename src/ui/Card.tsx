import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { playSound } from './sound'

interface CardProps {
  children: ReactNode
  /** When given, the card is a toggle button. */
  onSelect?: () => void
  selected?: boolean
  disabled?: boolean
  className?: string
  /** Accessible name when the card is selectable. */
  label?: string
  /** Inner padding (default true). Turn off for edge-to-edge art. */
  padded?: boolean
  /** data-testid for end-to-end tests. */
  testId?: string
}

const BASE =
  'block w-full overflow-hidden rounded-lg border bg-panel text-left transition-colors duration-150'

/** Surface for selectable items. Hover lifts it; selected gets the accent border and glow. */
export function Card({
  children,
  onSelect,
  selected = false,
  disabled,
  className = '',
  label,
  padded = true,
  testId,
}: CardProps) {
  const pad = padded ? 'p-4' : ''
  const state = selected
    ? 'border-accent shadow-glow'
    : 'border-border shadow-panel hover:border-border-strong'

  if (!onSelect) {
    return (
      <div data-testid={testId} className={`${BASE} ${pad} ${state} ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <motion.button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        playSound('click')
        onSelect()
      }}
      whileHover={disabled ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { y: 0, scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      // flex-col + justify-start: buttons centre content vertically by default, which misaligns
      // cards of different heights in the same grid row.
      className={`${BASE} ${pad} ${state} flex flex-col justify-start cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </motion.button>
  )
}
