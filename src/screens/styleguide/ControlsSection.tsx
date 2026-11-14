import { Badge, type BadgeVariant } from '@/ui/Badge'
import { Button, type ButtonSize, type ButtonVariant } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Panel } from '@/ui/Panel'
import { StatChip } from '@/ui/StatChip'
import { Tooltip } from '@/ui/Tooltip'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { useState } from 'react'

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
const SIZES: ButtonSize[] = ['sm', 'md', 'lg']
const BADGES: BadgeVariant[] = [
  'thinker',
  'practical',
  'leader',
  'warning',
  'success',
  'danger',
  'info',
  'neutral',
]

export function ControlsSection() {
  const [mode, setMode] = useState<'a' | 'b' | 'c'>('b')
  return (
    <Panel title="Controls" subtitle="Button, Badge, StatChip, Tooltip">
      <div className="space-y-3">
        {VARIANTS.map((v) => (
          <div key={v} className="flex flex-wrap items-center gap-3">
            <span className="w-24 font-mono text-xs text-subtle">{v}</span>
            {SIZES.map((s) => (
              <Button key={s} variant={v} size={s}>
                {v} {s}
              </Button>
            ))}
            <Button variant={v} icon={<Icon name="IconRocket" size={16} />}>
              With icon
            </Button>
            <Button variant={v} loading>
              Loading
            </Button>
            <Button variant={v} disabled>
              Disabled
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="w-24 font-mono text-xs text-subtle">badges</span>
        {BADGES.map((b) => (
          <Badge key={b} variant={b} />
        ))}
        <Badge variant="info">Custom text</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="w-24 font-mono text-xs text-subtle">stat chips</span>
        <StatChip icon="IconWeight" label="Mass" value="1,260" unit="kg" />
        <StatChip icon="IconBolt" label="Power" value="+5000" unit="W" tone="success" />
        <StatChip icon="IconBolt" label="Draw" value="-1500" unit="W" tone="alert" />
        <StatChip icon="IconCoin" label="Over" value="$42" unit="M" tone="danger" />
        <StatChip label="Signal delay" value="1.3" unit="s" tone="accent" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="w-24 font-mono text-xs text-subtle">tooltips</span>
        <Tooltip content="Signal takes about 1.3 s to reach the Moon.">
          <Button variant="secondary" size="sm">
            Hover or focus me
          </Button>
        </Tooltip>
        <Tooltip content="Shown below the trigger" side="bottom">
          <Button variant="ghost" size="sm">
            Bottom tooltip
          </Button>
        </Tooltip>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <span className="w-24 pt-2 font-mono text-xs text-subtle">segmented</span>
        <SegmentedControl
          label="Demo segmented control"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'a', label: 'Cadet', description: 'Arrow keys move the selection.' },
            {
              id: 'b',
              label: 'Engineer',
              description: 'The selected option shows its description.',
            },
            {
              id: 'c',
              label: 'Flight Director',
              description: 'Rendered as a radiogroup for screen readers.',
            },
          ]}
        />
      </div>
    </Panel>
  )
}
