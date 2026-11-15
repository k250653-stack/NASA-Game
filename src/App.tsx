import { lazy, Suspense, useLayoutEffect, type ComponentType } from 'react'
import { MotionConfig } from 'motion/react'
import { useStore, type Phase } from '@/store'
import { Starfield } from '@/ui/Starfield'
import { Toaster } from '@/ui/Toaster'
import { useSettings } from '@/ui/settingsStore'
import Title from '@/screens/Title'
import DestinationSelect from '@/screens/DestinationSelect'
import ScenarioSelect from '@/screens/ScenarioSelect'
import RoleSelect from '@/screens/RoleSelect'
import Recruit from '@/screens/Recruit'
import PlanningBoard from '@/screens/PlanningBoard'
import LaunchCheck from '@/screens/LaunchCheck'
import FailureReview from '@/screens/FailureReview'
import Codex from '@/screens/Codex'
import Styleguide from '@/screens/styleguide/Styleguide'
// Also installs the "finishing a step closes the station popup" rule.
import { useWorld } from '@/world/worldStore'

/** Phaser is large, so the walkable world loads only when the HQ is first opened. */
const HQWorld = lazy(() => import('@/world/HQWorld'))
/** The mission run plays in the habitat (also Phaser). */
const HabitatWorld = lazy(() => import('@/world/HabitatWorld'))

/** No router: the current phase in the store decides which screen is shown. */
const SCREENS: Record<Phase, ComponentType> = {
  title: Title,
  destination: DestinationSelect,
  scenario: ScenarioSelect,
  role: RoleSelect,
  recruit: Recruit,
  planning: PlanningBoard,
  launch: LaunchCheck,
  mission: HabitatWorld,
  review: FailureReview,
  codex: Codex,
  hq: HQWorld,
  styleguide: Styleguide,
}

export default function App() {
  const phase = useStore((s) => s.game.phase)
  const Screen = SCREENS[phase] ?? Title
  const reducedMotion = useSettings((s) => s.reducedMotion)
  // A station popup shows the phase's screen inside the HQ world instead of full screen.
  const popup = useWorld((s) => s.popup)
  const inWorld = phase === 'hq' || popup !== null
  // Each screen opens at the top (runs before a screen's own effects, e.g. Fix in Planning).
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])
  return (
    // Motion skips transform animations when the OS asks for less motion, or Settings does.
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <Starfield />
      <Suspense fallback={null}>
        {inWorld ? <HQWorld popup={phase !== 'hq' ? <Screen /> : null} /> : <Screen />}
      </Suspense>
      <Toaster />
    </MotionConfig>
  )
}
