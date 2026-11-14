import { PhaseShell } from '@/ui/PhaseShell'
import { AssetImage } from '@/ui/AssetImage'
import { getContent } from '@/content/load'

export default function Recruit() {
  const crew = getContent().crew
  return (
    <PhaseShell
      title="Recruit Your Crew"
      description="Hire teammates from crew.json. Balance Thinker / Practical / Leader traits and cover every role within budget."
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {crew.map((member) => (
          <li key={member.id} className="flex flex-col items-center gap-2 text-center">
            <AssetImage
              kind="portraits"
              id={member.portrait}
              label={member.name}
              className="h-20 w-20 rounded-lg"
            />
            <span className="text-sm text-slate-200">{member.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              {member.role}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        Portraits are placeholders until the WebP files are added (see public/assets/ASSETS.md).
      </p>
    </PhaseShell>
  )
}
