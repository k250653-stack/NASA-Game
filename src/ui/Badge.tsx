import type { ReactNode } from 'react'
import type { Trait } from '@/schemas'
import { TRAIT_LABEL } from './labels'

export type BadgeVariant = Trait | 'warning' | 'success' | 'danger' | 'info' | 'neutral'

const VARIANTS: Record<BadgeVariant, string> = {
  thinker: 'border-trait-thinker/40 bg-trait-thinker/12 text-trait-thinker',
  practical: 'border-trait-practical/40 bg-trait-practical/12 text-trait-practical',
  leader: 'border-trait-leader/40 bg-trait-leader/12 text-trait-leader',
  warning: 'border-alert/40 bg-alert/12 text-alert',
  success: 'border-success/40 bg-success/12 text-success',
  danger: 'border-danger/40 bg-danger/12 text-danger',
  info: 'border-accent/40 bg-accent/12 text-accent',
  neutral: 'border-border-strong bg-surface text-muted',
}

const DEFAULT_TEXT: Partial<Record<BadgeVariant, string>> = {
  ...TRAIT_LABEL,
  warning: 'Warning',
  success: 'Nominal',
  danger: 'Critical',
}

interface BadgeProps {
  variant?: BadgeVariant
  children?: ReactNode
  className?: string
}

/** Small tag for crew traits and status. Trait variants default to the trait name. */
export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase ${VARIANTS[variant]} ${className}`}
    >
      {children ?? DEFAULT_TEXT[variant] ?? variant}
    </span>
  )
}
