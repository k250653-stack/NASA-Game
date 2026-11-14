import { loadContent } from '@/content/load'
import { runLaunchCheck } from '../launchCheck'
import type { Check, Design } from '../types'

/** The budget line of the launch check for a design. */
export function launchCheckBudget(design: Design): Check {
  return runLaunchCheck(design, loadContent()).find((c) => c.id === 'budget')!
}
