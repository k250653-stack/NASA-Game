import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import type { TaskType } from '@/schemas'
import { Button } from '@/ui/Button'
import { shakeScreen } from '@/ui/feel'
import { SegmentBar } from '@/ui/SegmentBar'
import { playSound } from '@/ui/sound'
import { TASK_LABEL, taskSeed, type ActiveTask } from './crewTask'
import { DishAlign } from './tasks/DishAlign'
import { PanelClean } from './tasks/PanelClean'
import { PressureValve } from './tasks/PressureValve'
import type { TaskProps } from './tasks/types'
import { WirePatch } from './tasks/WirePatch'

const TASKS: Record<TaskType, ComponentType<TaskProps>> = {
  wire_patch: WirePatch,
  panel_clean: PanelClean,
  dish_align: DishAlign,
  pressure_valve: PressureValve,
}
/** How long the success flash / fail shake shows before the panel hands over, ms. */
const AFTER_MS = 700

interface TaskPanelProps {
  active: ActiveTask
  stationLabel: string
  /** completed = done in time (bonus applies); false = timed out, failed or skipped. */
  onFinish: (completed: boolean) => void
  /** Esc / × : close without finishing; the task stays in the list. */
  onClose: () => void
}

/** One hands-on task at its station: the time limit runs only while this panel is open. */
export function TaskPanel({ active, stationLabel, onFinish, onClose }: TaskPanelProps) {
  const limitMs = active.task.timeLimitSec * 1000
  const [left, setLeft] = useState(limitMs)
  const [result, setResult] = useState<'done' | 'failed' | null>(null)
  const ended = useRef(false)
  const finish = useRef(onFinish)
  useEffect(() => {
    finish.current = onFinish
  }, [onFinish])

  const end = useCallback((completed: boolean) => {
    if (ended.current) return
    ended.current = true
    setResult(completed ? 'done' : 'failed')
    playSound(completed ? 'success' : 'fail')
    if (!completed) shakeScreen('small')
    setTimeout(() => finish.current(completed), AFTER_MS)
  }, [])
  const complete = useCallback(() => end(true), [end])
  const fail = useCallback(() => end(false), [end])

  useEffect(() => {
    const t0 = performance.now()
    const id = setInterval(() => {
      const remaining = Math.max(0, limitMs - (performance.now() - t0))
      setLeft(remaining)
      if (remaining <= 0) end(false)
    }, 100)
    return () => clearInterval(id)
  }, [limitMs, end])

  useEffect(() => {
    // Capture phase so the habitat's own Esc handling does not also open the pause menu.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || ended.current) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const Task = TASKS[active.task.taskType]
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60"
      data-testid="task-panel"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TASK_LABEL[active.task.taskType]}
        className={`pixel-panel relative w-[520px] max-w-[94vw] px-5 py-3 ${result === 'done' ? 'outline-4 outline-accent' : ''}`}
      >
        <header className="flex items-center justify-between gap-3 pb-2">
          <h2 className="label-caps truncate text-xl text-primary">
            <span className="text-accent">{stationLabel} · </span>
            {TASK_LABEL[active.task.taskType]}
          </h2>
          <span className="font-mono text-sm text-primary tabular-nums">
            {Math.ceil(left / 1000)}s
          </span>
        </header>
        <SegmentBar
          share={left / limitMs}
          fill={left / limitMs > 0.3 ? 'bg-accent' : 'bg-alert'}
          segments={24}
          height="h-1.5"
        />
        <div className="mt-2">
          <Task seed={taskSeed(active.uid)} onComplete={complete} onFail={fail} />
        </div>
        <footer className="mt-2 flex items-center justify-between">
          <p className="label-caps text-sm" aria-live="polite">
            {result === 'done' && (
              <span className="text-accent">
                Done! +{Math.round(active.task.successBonus * 100)} points
              </span>
            )}
            {result === 'failed' && <span className="text-danger">Not done: normal chance</span>}
            {!result && <span className="text-subtle">Esc to step away · the task waits</span>}
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={result !== null}
            onClick={fail}
            data-testid="task-skip"
          >
            Skip task
          </Button>
        </footer>
      </div>
      {result === 'done' && (
        <div className="pointer-events-none fixed inset-0 animate-pulse bg-accent/10" aria-hidden />
      )}
    </div>
  )
}

/** HUD: the open task and where to do it (top-left, under the day badge). */
export function TaskList({
  active,
  stationLabel,
}: {
  active: ActiveTask | null
  stationLabel: string
}) {
  if (!active) return null
  return (
    <div className="pixel-panel mt-2 px-3 py-1.5" data-testid="task-list">
      <p className="label-caps text-xs text-accent">Task</p>
      <p className="text-sm text-primary">
        {TASK_LABEL[active.task.taskType]}: <span className="text-accent">{stationLabel}</span>
      </p>
    </div>
  )
}
