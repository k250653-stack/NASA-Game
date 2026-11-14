import { useState } from 'react'
import { DEMO_SEED, useStore } from '@/store'
import { Button } from '@/ui/Button'

/** "Seed: 48213" in the corner, with an edit field for typing a known seed (e.g. the demo seed). */
export function SeedControl() {
  const seed = useStore((s) => s.game.seed)
  const setSeed = useStore((s) => s.setSeed)
  const rollSeed = useStore((s) => s.rollSeed)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const parsed = Number(draft)
  const valid = draft.trim() !== '' && Number.isInteger(parsed) && parsed >= 0

  if (!editing) {
    return (
      <div className="flex shrink-0 items-center gap-2 text-xs text-subtle">
        <span className="font-mono tabular-nums" data-testid="seed-value">
          Seed: {seed}
        </span>
        <Button
          size="sm"
          variant="ghost"
          data-testid="seed-change"
          onClick={() => {
            setDraft(String(seed))
            setEditing(true)
          }}
        >
          Change
        </Button>
      </div>
    )
  }
  return (
    <form
      className="flex shrink-0 items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setSeed(parsed)
        setEditing(false)
      }}
    >
      <label className="text-xs text-subtle" htmlFor="seed-input">
        Seed
      </label>
      <input
        id="seed-input"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-invalid={!valid}
        className="h-8 w-28 rounded-md border border-border-strong bg-surface px-2 font-mono text-sm text-primary"
      />
      <Button size="sm" type="submit" disabled={!valid} data-testid="seed-set">
        Set
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDraft(String(DEMO_SEED))}
        data-testid="seed-demo"
      >
        Demo
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          rollSeed()
          setEditing(false)
        }}
      >
        Random
      </Button>
    </form>
  )
}
