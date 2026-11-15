import { useState } from 'react'
import { applyChanges, type DesignChange } from '@/engine/planning'
import { planningGauges, roleUsage } from '@/engine/planningHints'
import { tradeOptions } from '@/engine/planningOptions'
import { evaluateTrade, type Trade, type TradeResult } from '@/engine/trades'
import type { Design, EngineContent } from '@/engine/types'
import type { CrewMember, Role } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { ROLE_LABEL } from '@/ui/labels'
import { Modal } from '@/ui/Modal'
import { StatChip } from '@/ui/StatChip'
import { PrioritiesBar } from '../recruit/PrioritiesBar'

interface NegotiationModalProps {
  teammate: CrewMember | null
  playerRole: Role
  design: Design
  content: EngineContent
  onApply: (design: Design) => void
  onRecord: (accepted: boolean) => void
  onClose: () => void
}

const VERDICT_BADGE = { accept: 'success', counter: 'warning', refuse: 'danger' } as const

/** Build a trade with one teammate and see how they answer (engine: evaluateTrade). */
export function NegotiationModal(props: NegotiationModalProps) {
  const { teammate, onClose } = props
  return (
    <Modal
      open={teammate !== null}
      onClose={onClose}
      title={teammate ? `Negotiate with ${teammate.name}` : ''}
      size="lg"
    >
      {teammate && <NegotiationBody key={teammate.id} {...props} teammate={teammate} />}
    </Modal>
  )
}

function NegotiationBody({
  teammate,
  playerRole,
  design,
  content,
  onApply,
  onRecord,
}: NegotiationModalProps & { teammate: CrewMember }) {
  const give = tradeOptions(design, playerRole, content)
  const ask = tradeOptions(design, teammate.role, content)
  const [giveKey, setGiveKey] = useState('')
  const [askKey, setAskKey] = useState('')
  const [response, setResponse] = useState<TradeResult | null>(null)

  const pick = (list: typeof give, key: string): DesignChange[] =>
    list.filter((o) => o.key === key).map((o) => o.change)
  const trade: Trade = {
    from: playerRole,
    to: teammate.role,
    give: pick(give, giveKey),
    ask: pick(ask, askKey),
  }
  const preview = planningGauges(applyChanges(design, [...trade.give, ...trade.ask]), content)
  const now = planningGauges(design, content)
  const usage = roleUsage(design, teammate.role, content)
  const line = (r: TradeResult) => {
    const [verdict, index] = r.dialogueKey.split(':') as [
      keyof NonNullable<CrewMember['dialogue']>,
      string,
    ]
    return teammate.dialogue?.[verdict]?.[Number(index)] ?? ''
  }
  const expression = response?.verdict === 'accept' ? 'happy' : response ? 'worried' : null

  const propose = () => {
    const r = evaluateTrade(trade, teammate, design, content)
    setResponse(r)
    if (r.verdict === 'accept') onApply(applyChanges(design, [...trade.give, ...trade.ask]))
    if (r.verdict !== 'counter') onRecord(r.verdict === 'accept')
  }

  const select = (
    label: string,
    testId: string,
    value: string,
    onChange: (v: string) => void,
    options: typeof give,
  ) => (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setResponse(null)
        }}
        className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-primary"
      >
        <option value="">Nothing</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-5">
      <div className="flex flex-col gap-3">
        <AssetImage
          kind="portraits"
          id={expression ? `${teammate.portrait}-${expression}` : teammate.portrait}
          fallbackId={teammate.portrait}
          label={teammate.name}
          className="size-32"
        />
        <p className="text-xs text-muted">{ROLE_LABEL[teammate.role]}</p>
        <PrioritiesBar priorities={teammate.priorities} />
        <p className="font-mono text-xs text-muted">
          Uses {Math.round(usage.massKg).toLocaleString('en-US')} kg · {Math.round(usage.powerW)} W
          · ${Math.round(usage.costM)}M
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <blockquote
          className="rounded-md border-l-4 border-accent bg-surface px-3 py-2 text-primary"
          data-testid="teammate-line"
        >
          “{response ? line(response) : (teammate.dialogue?.request[0] ?? 'What do you need?')}”
        </blockquote>
        <div className="grid grid-cols-2 gap-3">
          {select('You give (your items)', 'trade-give', giveKey, setGiveKey, give)}
          {select(`You ask (${teammate.name}'s items)`, 'trade-ask', askKey, setAskKey, ask)}
        </div>
        <div className="flex flex-wrap gap-2">
          {preview
            .filter((g) => ['mass', 'budget', 'power'].includes(g.id))
            .map((g) => {
              const before = now.find((x) => x.id === g.id)!
              return (
                <StatChip
                  key={g.id}
                  label={`${g.label} if accepted`}
                  value={`${Math.round(before.value).toLocaleString('en-US')} → ${Math.round(g.value).toLocaleString('en-US')}`}
                  unit={g.unit}
                  tone={g.status === 'fail' ? 'danger' : g.status === 'warn' ? 'alert' : 'success'}
                />
              )
            })}
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={propose}
            disabled={trade.give.length + trade.ask.length === 0}
            data-testid="propose-trade"
          >
            Propose
          </Button>
          {response?.verdict === 'counter' && response.counter && (
            <Button
              variant="secondary"
              data-testid="accept-counter"
              onClick={() => {
                onApply(applyChanges(design, [...response.counter!.give, ...response.counter!.ask]))
                onRecord(true)
                setResponse({ ...response, verdict: 'accept', reason: 'Counter-offer accepted.' })
              }}
            >
              Accept counter-offer
            </Button>
          )}
        </div>
        {response && (
          <div
            className="flex items-start gap-2 text-sm"
            data-testid="trade-response"
            data-verdict={response.verdict}
          >
            <Badge variant={VERDICT_BADGE[response.verdict]}>{response.verdict}</Badge>
            <p className="text-muted">{response.reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}
