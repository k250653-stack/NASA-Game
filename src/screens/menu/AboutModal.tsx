import type { ReactNode } from 'react'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-xs tracking-[0.25em] text-accent uppercase">{title}</h3>
      <div className="space-y-2 text-sm text-muted">{children}</div>
    </section>
  )
}

/** The challenge, the AI disclosure required by the event, and credits. */
export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="About the event"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-6">
        <Section title="The challenge">
          <p>
            Made for the NASA Space Apps Challenge 2026, &ldquo;Space Mission Design Game&rdquo;:
            build a game where players design a space mission and learn that every decision affects
            the other systems.
          </p>
          <p>
            In Mission Control you plan a crewed trip to the Moon or Mars, share mass, power and
            budget with your crew, fly the mission day by day, and then see <em>why</em> it went
            well or badly before you redesign and fly again.
          </p>
        </Section>
        <Section title="AI disclosure">
          <p>
            AI coding assistants helped write the code for this project. The game itself uses no AI
            while you play: the crew and NOVA follow fixed rules, and every number comes from the
            game&rsquo;s data files.
          </p>
          <p>Any AI-generated image in the game carries a visible watermark.</p>
        </Section>
        <Section title="Credits">
          <p>Title font: Barlow Condensed by Jeremy Tribby (SIL Open Font License).</p>
          <p>Interface fonts: Inter, Space Grotesk, JetBrains Mono (SIL Open Font License).</p>
          <p>Full asset list with licenses: CREDITS.md in the project repository.</p>
          <p>Not affiliated with or endorsed by NASA.</p>
        </Section>
      </div>
    </Modal>
  )
}
