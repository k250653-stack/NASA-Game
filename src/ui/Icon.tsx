import { createElement } from 'react'
import { getIcon } from './icons'

interface IconProps {
  /** Tabler component name, e.g. "IconBattery". */
  name: string
  size?: number
  className?: string
}

/** Renders a registered Tabler icon by name. Decorative: hidden from screen readers. */
export function Icon({ name, size = 18, className }: IconProps) {
  return createElement(getIcon(name), { size, stroke: 1.75, className, 'aria-hidden': true })
}
