import { useWorld } from './worldStore'

/** Full-screen black used for door transitions. Blocks clicks only while visible. */
export function FadeOverlay() {
  const fade = useWorld((s) => s.fade)
  return (
    <div
      aria-hidden
      data-overlay
      className={`fixed inset-0 z-[60] bg-bg transition-opacity ease-in-out ${fade.opacity > 0 ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ opacity: fade.opacity, transitionDuration: `${fade.ms}ms` }}
    />
  )
}
