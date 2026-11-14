import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { Panel } from '@/ui/Panel'
import { toast } from '@/ui/uiStore'

export function OverlaysSection() {
  const [open, setOpen] = useState(false)
  return (
    <Panel title="Overlays" subtitle="Modal (Esc closes, focus trapped) and stacked toasts">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Button
          variant="secondary"
          onClick={() => toast.info('Downlink complete', '12 MB of spectra received.')}
        >
          Info toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.warning('Battery low', 'Below 30% with 4 days to sunrise.')}
        >
          Warning toast
        </Button>
        <Button
          variant="danger"
          onClick={() => toast.danger('Antenna lost lock', 'Stays until dismissed.')}
        >
          Danger toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.success('Ice confirmed', 'Science target reached.')}
        >
          Success toast
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="NOVA: Why the Moon takes three days"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Skip
            </Button>
            <Button onClick={() => setOpen(false)}>Got it</Button>
          </>
        }
      >
        <p className="text-muted">
          Speeding up at one point of an orbit raises the opposite point. A burn in low Earth orbit
          stretches the orbit into an ellipse that reaches the Moon after about three days.
        </p>
        <p className="mt-3 text-sm text-subtle">Tab cycles inside this dialog. Esc closes it.</p>
      </Modal>
    </Panel>
  )
}
