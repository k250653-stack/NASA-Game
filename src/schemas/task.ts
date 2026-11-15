import { z } from 'zod'
import { IdSchema } from './shared'

/** Hands-on crew tasks the player can do themselves (world/mission/tasks). */
export const TASK_TYPES = ['wire_patch', 'panel_clean', 'dish_align', 'pressure_valve'] as const
export const TaskTypeSchema = z.enum(TASK_TYPES, {
  error: () => `taskType must be one of: ${TASK_TYPES.join(', ')}`,
})
export type TaskType = z.infer<typeof TaskTypeSchema>

/** Habitat stations a task can be done at (same ids as the habitat workstations). */
export const TASK_STATIONS = ['power', 'comms', 'science', 'repair', 'airlock'] as const

export const CrewTaskSchema = z.strictObject({
  /** The event that offers "Do it yourself" (one task per event). */
  id: IdSchema,
  taskType: TaskTypeSchema,
  station: z.enum(TASK_STATIONS, {
    error: () => `station must be one of: ${TASK_STATIONS.join(', ')}`,
  }),
  /** Finish within this many seconds (while the task panel is open) for the bonus. */
  timeLimitSec: z.number().positive({ error: 'timeLimitSec must be > 0' }),
  /** Added to the success chance when completed in time (0.3 = +30 points, capped). */
  successBonus: z.number().min(0).max(1),
})
export type CrewTask = z.infer<typeof CrewTaskSchema>
