/**
 * Hands-on crew tasks: which events offer "Do it yourself" (content/tasks.json), the engine option
 * and crew member that doing it yourself stands for, the active task, and per-mission counts.
 * Read the stores with selectors: useCrewTask((s) => s.active).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getContent } from '@/content/load'
import { availableOptions, eligibleCrew, needsCrew, successChance } from '@/engine/events'
import { playerCharacterId } from '@/engine/recruitment'
import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { CrewTask, GameEvent, RoleChoice, TaskType } from '@/schemas'

/** Short task names for the HUD list, e.g. "Rewire: Power & Life Support Panel". */
export const TASK_LABEL: Record<TaskType, string> = {
  wire_patch: 'Rewire',
  panel_clean: 'Clean the panels',
  dish_align: 'Align the dish',
  pressure_valve: 'Bleed the valve',
}

export function taskFor(eventId: string): CrewTask | undefined {
  return getContent().tasks.find((t) => t.id === eventId)
}

export interface DiyPlan {
  optionId: string
  crewId: string | null
}

/**
 * The engine option "doing it yourself" stands for: the event's repair option, else the first
 * workable option. The player's own character acts when they can, else the best rested crew.
 */
export function diyPlan(
  run: MissionState,
  event: GameEvent,
  design: Design,
  content: EngineContent,
  seat: RoleChoice | null,
): DiyPlan | null {
  const ctx = { design, content }
  const avail = availableOptions(run, event, design, content).filter((a) => a.available)
  const pick = avail.find((a) => a.option.tags.includes('repair')) ?? avail[0]
  if (!pick) return null
  if (!needsCrew(pick.option)) return { optionId: pick.option.id, crewId: null }
  const crew = eligibleCrew(run, pick.option, ctx)
  const me = seat ? crew.find((m) => m.id === playerCharacterId(seat)) : undefined
  const best =
    me ??
    [...crew].sort(
      (a, b) =>
        successChance(run, event, pick.option, b, ctx) -
        successChance(run, event, pick.option, a, ctx),
    )[0]
  return best ? { optionId: pick.option.id, crewId: best.id } : null
}

export interface ActiveTask {
  /** Pending event uid (eventId@turn). */
  uid: string
  eventId: string
  task: CrewTask
  plan: DiyPlan
}

interface CrewTaskState {
  active: ActiveTask | null
  /** The task panel is open (player movement stops). */
  open: boolean
  set: (patch: Partial<Pick<CrewTaskState, 'active' | 'open'>>) => void
}

export const useCrewTask = create<CrewTaskState>()((set) => ({
  active: null,
  open: false,
  set: (patch) => set(patch),
}))

interface TaskStatsState {
  /** Which mission these counts belong to (seed + first log line). */
  runKey: string
  attempted: number
  completed: number
  record: (runKey: string, completed: boolean) => void
}

/** Hands-on tasks per mission, for the debrief ("Hands-on tasks: X/Y completed"). */
export const useTaskStats = create<TaskStatsState>()(
  persist(
    (set) => ({
      runKey: '',
      attempted: 0,
      completed: 0,
      record: (runKey, completed) =>
        set((s) => {
          const base = s.runKey === runKey ? s : { attempted: 0, completed: 0 }
          return {
            runKey,
            attempted: base.attempted + 1,
            completed: base.completed + (completed ? 1 : 0),
          }
        }),
    }),
    { name: 'mission-control-tasks', storage: createJSONStorage(() => localStorage) },
  ),
)

/** Identifies one mission run (a new launch starts new counts). */
export function runKey(run: MissionState): string {
  return `${run.seed}|${run.destinationId}|${run.eventLog[0]?.text ?? ''}`
}

/** Stable small seed for a task's layout (the seeded rng then shuffles from it). */
export function taskSeed(uid: string): number {
  let h = 2166136261
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619) >>> 0
  return h
}
