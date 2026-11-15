import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { playSound } from '@/ui/sound'
import { NovaSprite } from './NovaSprite'
import { openCodex } from './novaStore'

/** Typewriter speed. */
const CHAR_MS = 14
/** NOVA blips once per this many letters. */
const BEEP_EVERY = 6

interface NovaCompanionProps {
  /** Lines to say, one bubble each; null or empty = NOVA just hovers. */
  lines: readonly string[] | null
  /** All lines read (Enter on the last one). */
  onDone?: () => void
  /** Shown as "Skip tutorial" while lines are up. */
  onSkip?: () => void
  /** Position classes, e.g. "bottom-10 left-4". */
  className?: string
}

/**
 * NOVA floating near the bottom-left with a speech bubble. Text types out; click or Space shows
 * the whole line, Enter (or click when complete) moves on. Clicking NOVA when quiet opens the notes.
 */
export function NovaCompanion({
  lines,
  onDone,
  onSkip,
  className = 'bottom-10 left-4',
}: NovaCompanionProps) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const [source, setSource] = useState(lines)
  if (source !== lines) {
    // New script: start from its first line.
    setSource(lines)
    setIndex(0)
    setShown(0)
  }
  const line = lines?.[index] ?? null
  const full = line !== null && (reduced || shown >= line.length)

  useEffect(() => {
    if (line === null || full) return
    const t = setTimeout(() => {
      // A short blip every few letters while NOVA talks.
      if (shown % BEEP_EVERY === 0) playSound('nova-beep')
      setShown((s) => s + 1)
    }, CHAR_MS)
    return () => clearTimeout(t)
  }, [line, full, shown])

  const advance = () => {
    if (line === null) return
    if (!full) return setShown(line.length)
    if (lines && index < lines.length - 1) {
      setIndex(index + 1)
      setShown(0)
    } else onDone?.()
  }

  useEffect(() => {
    if (line === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !full) {
        e.preventDefault()
        setShown(line.length)
      } else if (e.key === 'Enter' && full) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={`absolute z-30 flex items-end gap-2 ${className}`} data-testid="nova-companion">
      <button
        type="button"
        onClick={line ? advance : openCodex}
        aria-label={line ? 'Next' : "NOVA's notes"}
        className="focus-visible:outline-2 focus-visible:outline-accent"
      >
        <NovaSprite talking={line !== null && !full} />
      </button>
      {line !== null && (
        <div
          className="mb-6 max-w-sm border border-accent/70 bg-bg/95 px-3 py-2"
          role="status"
          data-testid="nova-bubble"
        >
          <p className="font-title text-xs tracking-widest text-accent uppercase">NOVA</p>
          <button type="button" onClick={advance} className="block text-left text-sm text-primary">
            <span aria-hidden>{reduced ? line : line.slice(0, shown)}</span>
            <span className="sr-only">{line}</span>
          </button>
          <p className="mt-1 flex justify-between gap-4 font-mono text-xs text-subtle">
            <span>
              {full
                ? lines && index < lines.length - 1
                  ? 'Enter ▸ next'
                  : 'Enter ▸ ok'
                : 'Space ▸ skip'}
            </span>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="text-muted underline hover:text-primary"
                data-testid="nova-skip-tutorial"
              >
                Skip tutorial
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
