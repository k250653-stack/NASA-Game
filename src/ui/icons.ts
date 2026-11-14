/**
 * Tabler icon registry. Content JSON refers to icons by name ("IconBattery"); only icons listed
 * here are bundled (importing all of Tabler would add megabytes). Add new names here when content
 * needs them; a test checks that every icon in parts.json is registered.
 */
import type { ComponentType } from 'react'
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconAntenna,
  IconBattery,
  IconBolt,
  IconCar,
  IconCircleCheck,
  IconCoin,
  IconDroplet,
  IconFlask,
  IconInfoCircle,
  IconLungs,
  IconMicroscope,
  IconMinus,
  IconPlus,
  IconQuestionMark,
  IconRocket,
  IconShirt,
  IconSolarPanel,
  IconTool,
  IconUser,
  IconVolume,
  IconVolumeOff,
  IconWeight,
  IconX,
} from '@tabler/icons-react'

export type IconComponent = ComponentType<{
  size?: number | string
  stroke?: number | string
  className?: string
  'aria-hidden'?: boolean
}>

export const ICONS: Record<string, IconComponent> = {
  IconAlertOctagon,
  IconAlertTriangle,
  IconAntenna,
  IconBattery,
  IconBolt,
  IconCar,
  IconCircleCheck,
  IconCoin,
  IconDroplet,
  IconFlask,
  IconInfoCircle,
  IconLungs,
  IconMicroscope,
  IconMinus,
  IconPlus,
  IconQuestionMark,
  IconRocket,
  IconShirt,
  IconSolarPanel,
  IconTool,
  IconUser,
  IconVolume,
  IconVolumeOff,
  IconWeight,
  IconX,
}

export function hasIcon(name: string): boolean {
  return name in ICONS
}

/** Returns the registered icon, or a question mark so a typo never crashes a screen. */
export function getIcon(name: string): IconComponent {
  return ICONS[name] ?? IconQuestionMark
}
