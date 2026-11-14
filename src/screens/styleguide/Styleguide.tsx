import { useStore } from '@/store'
import { Button } from '@/ui/Button'
import { ScreenLayout } from '@/ui/ScreenLayout'
import { TokensSection } from './TokensSection'
import { ControlsSection } from './ControlsSection'
import { DataSection } from './DataSection'
import { CardsSection } from './CardsSection'
import { OverlaysSection } from './OverlaysSection'
import { NavigationSection } from './NavigationSection'
import { SidebarDemo } from './SidebarDemo'

/** Dev-only screen: every UI kit component in all its variants and states. */
export default function Styleguide() {
  const setPhase = useStore((s) => s.setPhase)
  return (
    <ScreenLayout sidebar={<SidebarDemo />}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent uppercase">Dev · UI kit</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-primary">Design system</h1>
          <p className="mt-2 text-muted">
            Every shared component in every state. Tokens live in src/index.css; see THEME.md.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setPhase('title')}>
          ← Title
        </Button>
      </div>
      <TokensSection />
      <ControlsSection />
      <DataSection />
      <NavigationSection />
      <OverlaysSection />
      <CardsSection />
    </ScreenLayout>
  )
}
