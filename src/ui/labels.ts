/** Human-readable labels for enum values. UI text only, no game numbers. */
import type { PartCategory, Role, SkillKey, Trait } from '@/schemas'
import type { Phase } from '@/store'

export const ROLE_LABEL: Record<Role, string> = {
  science: 'Science',
  power_life: 'Power & Life Support',
  comms_nav: 'Comms & Navigation',
  launch_budget: 'Launch & Budget',
}

export const TRAIT_LABEL: Record<Trait, string> = {
  thinker: 'Thinker',
  practical: 'Practical',
  leader: 'Leader',
}

export const SKILL_LABEL: Record<SkillKey, string> = {
  power: 'PWR',
  comms: 'COM',
  science: 'SCI',
  systems: 'SYS',
  navigation: 'NAV',
}

export const CATEGORY_LABEL: Record<PartCategory, string> = {
  instrument: 'Instrument',
  power: 'Power',
  battery: 'Battery',
  comms: 'Comms',
  life_support: 'Life Support',
  suit: 'Suit',
  spares: 'Spares',
  rover: 'Rover',
  habitat: 'Habitat',
}

export const PHASE_LABEL: Record<Phase, string> = {
  title: 'Title',
  destination: 'Destination',
  scenario: 'Scenario',
  role: 'Role',
  recruit: 'Crew',
  planning: 'Plan',
  launch: 'Launch',
  mission: 'Mission',
  review: 'Review',
  codex: 'Codex',
  hq: 'HQ',
  styleguide: 'UI Kit',
}

/** The phases shown in the top-bar stepper (the core game loop). */
export const STEPPER_PHASES: readonly Phase[] = [
  'destination',
  'scenario',
  'role',
  'recruit',
  'planning',
  'launch',
  'mission',
  'review',
]
