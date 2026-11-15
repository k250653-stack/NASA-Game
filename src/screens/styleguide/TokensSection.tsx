import { Panel } from '@/ui/Panel'

const COLOR_TOKENS = [
  'bg',
  'surface',
  'panel',
  'panel-raised',
  'border',
  'border-strong',
  'primary',
  'muted',
  'subtle',
  'accent',
  'accent-strong',
  'alert',
  'danger',
  'success',
  'trait-thinker',
  'trait-practical',
  'trait-leader',
] as const

export function TokensSection() {
  return (
    <Panel title="Tokens" subtitle="Colours, type and radii from src/index.css">
      <div className="grid grid-cols-6 gap-3 2xl:grid-cols-9">
        {COLOR_TOKENS.map((name) => (
          <div key={name} className="min-w-0">
            <div
              className="h-12 rounded-md border border-border-strong"
              style={{ background: `var(--color-${name})` }}
            />
            <p className="mt-1 truncate font-mono text-xs text-muted">{name}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-6 border-t border-border pt-4">
        <div>
          <p className="text-xs text-subtle uppercase">Display · font-display</p>
          <p className="font-display text-3xl font-bold text-primary">Shackleton 28</p>
        </div>
        <div>
          <p className="text-xs text-subtle uppercase">Body · font-sans</p>
          <p className="text-base text-primary">Dust on the array cuts power before nightfall.</p>
        </div>
        <div>
          <p className="text-xs text-subtle uppercase">Numbers · font-mono</p>
          <p className="font-mono text-2xl text-accent tabular-nums">18,420.5 Wh</p>
        </div>
      </div>
      <div className="mt-6 flex gap-4 border-t border-border pt-4">
        {(['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl'] as const).map((r) => (
          <div key={r} className="text-center">
            <div className={`size-14 border border-accent bg-accent/10 ${r}`} />
            <p className="mt-1 font-mono text-xs text-muted">{r}</p>
          </div>
        ))}
        <div className="text-center">
          <div className="size-14 rounded-lg bg-panel shadow-panel" />
          <p className="mt-1 font-mono text-xs text-muted">shadow-panel</p>
        </div>
        <div className="text-center">
          <div className="size-14 rounded-lg bg-panel shadow-glow" />
          <p className="mt-1 font-mono text-xs text-muted">shadow-glow</p>
        </div>
      </div>
    </Panel>
  )
}
