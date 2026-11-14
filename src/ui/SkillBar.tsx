import { SKILL_MAX } from '@/schemas'

interface SkillBarProps {
  label: string
  level: number
}

/** Tiny segmented bar for a 0..SKILL_MAX crew skill. */
export function SkillBar({ label, level }: SkillBarProps) {
  return (
    <div className="min-w-0" title={`${label} ${level}/${SKILL_MAX}`}>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] text-muted">
        <span>{label}</span>
        <span className="text-accent tabular-nums">{level}</span>
      </div>
      <div className="flex gap-0.5" aria-label={`${label} ${level} of ${SKILL_MAX}`} role="img">
        {Array.from({ length: SKILL_MAX }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-[1px] ${i < level ? 'bg-accent' : 'bg-border'}`}
          />
        ))}
      </div>
    </div>
  )
}
