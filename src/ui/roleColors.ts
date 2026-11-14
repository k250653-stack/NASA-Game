/** Tailwind classes for each role colour token (tokens live in src/index.css). */
import type { Role, RoleChoice } from '@/schemas'

type RoleColor = 'role-science' | 'role-power' | 'role-comms' | 'role-budget' | 'role-director'

export const ROLE_COLOR_CLASS: Record<
  RoleColor,
  { text: string; border: string; bg: string; topBorder: string }
> = {
  'role-science': {
    text: 'text-role-science',
    border: 'border-role-science/50',
    bg: 'bg-role-science/10',
    topBorder: 'border-t-role-science',
  },
  'role-power': {
    text: 'text-role-power',
    border: 'border-role-power/50',
    bg: 'bg-role-power/10',
    topBorder: 'border-t-role-power',
  },
  'role-comms': {
    text: 'text-role-comms',
    border: 'border-role-comms/50',
    bg: 'bg-role-comms/10',
    topBorder: 'border-t-role-comms',
  },
  'role-budget': {
    text: 'text-role-budget',
    border: 'border-role-budget/50',
    bg: 'bg-role-budget/10',
    topBorder: 'border-t-role-budget',
  },
  'role-director': {
    text: 'text-role-director',
    border: 'border-role-director/50',
    bg: 'bg-role-director/10',
    topBorder: 'border-t-role-director',
  },
}

/** Colour token for a crew role or seat. */
export const ROLE_COLOR: Record<RoleChoice, RoleColor> = {
  science: 'role-science',
  power_life: 'role-power',
  comms_nav: 'role-comms',
  launch_budget: 'role-budget',
  director: 'role-director',
}

export function roleClasses(role: Role | RoleChoice) {
  return ROLE_COLOR_CLASS[ROLE_COLOR[role]]
}
