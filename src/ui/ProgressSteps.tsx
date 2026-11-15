import { Fragment } from 'react'
import type { Phase } from '@/store'
import { PHASE_LABEL, STEPPER_PHASES } from './labels'

interface ProgressStepsProps {
  current: Phase
  steps?: readonly Phase[]
  /** Only the current step shows its label (narrow top bars). */
  compact?: boolean
}

/** Game-loop stepper: done steps dim accent, current step bright accent, future steps grey. */
export function ProgressSteps({
  current,
  steps = STEPPER_PHASES,
  compact = false,
}: ProgressStepsProps) {
  const currentIndex = steps.indexOf(current)
  return (
    <ol className="flex items-center gap-1.5" aria-label="Mission progress">
      {steps.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo'
        return (
          <Fragment key={step}>
            {i > 0 && (
              <li
                aria-hidden
                className={`h-px w-4 ${i <= currentIndex ? 'bg-accent/60' : 'bg-border-strong'}`}
              />
            )}
            <li
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex items-center gap-1.5"
            >
              <span
                className={`flex size-5 items-center justify-center rounded-full border font-mono text-xs ${
                  state === 'current'
                    ? 'border-accent bg-accent text-on-accent'
                    : state === 'done'
                      ? 'border-accent/60 text-accent'
                      : 'border-border-strong text-subtle'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-xs font-medium ${compact && state !== 'current' ? 'sr-only 2xl:not-sr-only' : ''} ${
                  state === 'current'
                    ? 'text-primary'
                    : state === 'done'
                      ? 'text-muted'
                      : 'text-subtle'
                }`}
              >
                {PHASE_LABEL[step]}
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
