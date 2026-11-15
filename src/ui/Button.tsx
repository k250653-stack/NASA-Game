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
  'inline-flex select-none items-center justify-center gap-2 border-2 font-display uppercase ' +
  'tracking-[0.12em] transition-[background-color,border-color,color,transform] duration-100 ' +
  'enabled:hover:-translate-y-px enabled:active:translate-y-px enabled:active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

/** Amber = primary action, steel = secondary, red only for danger. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-alert bg-alert text-on-alert enabled:hover:border-alert-strong enabled:hover:bg-alert-strong',
  secondary:
    'border-border-strong bg-panel text-primary enabled:hover:border-accent enabled:hover:text-accent',
  ghost: 'border-transparent text-muted enabled:hover:border-border enabled:hover:text-primary',
  danger: 'border-danger bg-panel text-danger enabled:hover:bg-danger/15',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg',
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
