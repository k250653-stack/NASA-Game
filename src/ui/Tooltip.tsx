import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface TooltipProps {
  content: ReactNode
  /** A single focusable element (button, link...). It gets aria-describedby. */
  children: ReactElement<{ 'aria-describedby'?: string }>
  side?: 'top' | 'bottom'
}

/** Shows on hover and on keyboard focus; Esc hides it. */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const pos = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={`pointer-events-none absolute left-1/2 z-40 w-max max-w-64 -translate-x-1/2 ${pos} border-2 border-border-strong bg-panel px-2.5 py-1.5 text-sm text-primary`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
