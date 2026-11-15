import { SKILL_MAX } from '@/schemas'

interface SkillBarProps {
  label: string
  level: number
}

/** Tiny segmented bar for a 0..SKILL_MAX crew skill. */
export function SkillBar({ label, level }: SkillBarProps) {
  return (
    <div className="min-w-0" title={`${label} ${level}/${SKILL_MAX}`}>
      <div className="mb-1 flex items-baseline justify-between font-mono text-xs text-muted">
        <span>{label}</span>
        <span className="text-accent tabular-nums">{level}</span>
      </div>
      <div className="flex gap-[2px]" aria-label={`${label} ${level} of ${SKILL_MAX}`} role="img">
        {Array.from({ length: SKILL_MAX }, (_, i) => (
          <span key={i} className={`h-2 flex-1 ${i < level ? 'bg-accent' : 'bg-surface'}`} />
        ))}
      </div>
    </div>
  )
}
