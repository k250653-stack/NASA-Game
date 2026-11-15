import type { CauseChain, CauseSeverity } from '@/engine/causes'

const SEVERITY: Record<CauseSeverity, { label: string; text: string; border: string }> = {
  critical: { label: 'Critical', text: 'text-danger', border: 'border-danger' },
  major: { label: 'Major', text: 'text-alert', border: 'border-alert' },
  minor: { label: 'Minor', text: 'text-muted', border: 'border-border-strong' },
  positive: { label: 'Positive', text: 'text-success', border: 'border-success' },
}

/** "What happened": each cause chain as severity, headline, arrow chain, root decision, tip. */
export function CauseList({ causes }: { causes: readonly CauseChain[] }) {
  if (causes.length === 0) return <p className="text-sm text-muted">Nothing stood out this time.</p>
  return (
    <ol className="space-y-3" data-testid="cause-list">
      {causes.slice(0, 5).map((c) => {
        const sev = SEVERITY[c.severity]
        return (
          <li key={c.id} className={`border-l-2 pl-3 ${sev.border}`} data-severity={c.severity}>
            <p className="font-title text-sm tracking-widest uppercase">
              <span className={sev.text}>{sev.label}</span>
              <span className="text-primary"> · {c.headline}</span>
            </p>
            <p className="mt-1 font-mono text-xs text-muted">{c.steps.join('  →  ')}</p>
            <p className="mt-1 text-xs text-muted">
              Design decision:{' '}
              <mark className="bg-alert/15 px-1 font-mono text-alert">
                {c.rootDesignDecision.label}: {String(c.rootDesignDecision.value)}
              </mark>
            </p>
            <p className="mt-1 text-sm text-primary">
              <span className="font-title tracking-wide text-accent uppercase">Try · </span>
              {c.suggestion}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
