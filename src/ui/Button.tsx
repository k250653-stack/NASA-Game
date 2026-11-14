import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { playSound } from './sound'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Icon shown before the label. */
  icon?: ReactNode
  /** Skip the click sound (e.g. for very frequent buttons). */
  silent?: boolean
}

const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-md font-display font-semibold ' +
  'uppercase tracking-wider transition-colors duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong disabled:hover:bg-accent',
  secondary:
    'border border-border-strong bg-panel-raised text-primary hover:border-accent hover:text-accent',
  ghost: 'text-muted hover:bg-panel-raised hover:text-primary',
  danger: 'border border-danger/50 bg-danger/15 text-danger hover:bg-danger/25',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  silent = false,
  disabled,
  onClick,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!silent) playSound('click')
    onClick?.(e)
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <IconLoader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
