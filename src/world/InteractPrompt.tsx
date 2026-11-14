import type { Ref } from 'react'

interface InteractPromptProps {
  ref: Ref<HTMLDivElement>
  /** Text after "E ·", e.g. "Enter Personnel" or "Use Desk Terminal". */
  action: string
  /** Shown instead of the action, tinted red, when set. */
  lockedLabel?: string
  lockReason?: string | null
  /** Initial anchor in canvas pixels; HQWorld moves it every frame via the ref. */
  x: number
  y: number
}

/** Small pixel prompt above the player's head. */
export function InteractPrompt({ ref, action, lockedLabel, lockReason, x, y }: InteractPromptProps) {
  return (
    <div
      ref={ref}
      data-testid="interact-prompt"
      className={`pointer-events-none absolute top-0 left-0 z-10 border bg-bg/90 px-2 py-1 font-mono text-xs whitespace-nowrap uppercase ${lockReason ? 'border-danger/70 text-danger' : 'border-border-strong text-primary'}`}
      style={{ transform: promptTransform(x, y) }}
    >
      {lockReason ? (
        <>
          <span className="block">Locked · {lockedLabel}</span>
          <span className="block text-danger/80 normal-case">{lockReason}</span>
        </>
      ) : (
        <>E · {action}</>
      )}
    </div>
  )
}

/** Centred above the anchor with a small gap. */
export function promptTransform(x: number, y: number): string {
  return `translate(${Math.round(x)}px, ${Math.round(y) - 8}px) translate(-50%, -100%)`
}
