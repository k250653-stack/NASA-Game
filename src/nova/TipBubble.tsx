import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { getContent } from '@/content/load'
import { playSound } from '@/ui/sound'
import { NovaSprite } from './NovaSprite'
import { openLesson } from './novaStore'
import { dismissTip, subscribeTips, tipState, TIP_SHOW_MS } from './tips'

/** Typewriter speed, ms per letter. */
const CHAR_MS = 20

/** NOVA's contextual tip: bottom-left, typewriter text, "Learn more" and a click-away. */
export function TipBubble() {
  const reduced = useReducedMotion()
  const [tip, setTip] = useState(tipState().current)
  const [shown, setShown] = useState(0)
  useEffect(() => subscribeTips((s) => (setTip(s.current), setShown(0))), [])
  useEffect(() => {
    if (!tip) return
    const t = setTimeout(dismissTip, TIP_SHOW_MS)
    return () => clearTimeout(t)
  }, [tip])
  useEffect(() => {
    if (!tip || reduced || shown >= tip.text.length) return
    const t = setTimeout(() => {
      if (shown % 4 === 0) playSound('nova-beep')
      setShown((n) => n + 1)
    }, CHAR_MS)
    return () => clearTimeout(t)
  }, [tip, shown, reduced])
  if (!tip) return null
  const lesson = tip.lessonId && getContent().lessons.some((l) => l.id === tip.lessonId)
  return (
    <div
      className="fixed bottom-4 left-4 z-[35] flex max-w-md items-end gap-2"
      role="status"
      data-testid="nova-tip"
      data-tip={tip.id}
    >
      <NovaSprite size={48} talking={shown < tip.text.length} />
      <div className="pixel-panel mb-2 px-3 py-2">
        <p className="label-caps text-xs text-accent">
          NOVA {tip.kind === 'fact' ? '· did you know' : ''}
        </p>
        <p className="text-sm text-primary">{reduced ? tip.text : tip.text.slice(0, shown)}</p>
        <div className="mt-1 flex gap-3 font-mono text-xs">
          {lesson && (
            <button
              type="button"
              className="text-accent underline"
              onClick={() => (dismissTip(), openLesson(tip.lessonId!))}
              data-testid="tip-learn-more"
            >
              Learn more
            </button>
          )}
          <button type="button" className="text-muted underline" onClick={dismissTip}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
