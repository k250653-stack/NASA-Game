import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const BASE =
  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold tracking-wide uppercase transition ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-space-950 hover:bg-accent-soft active:bg-accent-deep',
  ghost: 'border border-space-500 text-slate-200 hover:border-accent hover:text-accent',
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return <button type="button" className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest} />
}
