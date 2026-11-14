import { useLayoutEffect, type ComponentType } from 'react'
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
import MissionControl from '@/screens/MissionControl'
import FailureReview from '@/screens/FailureReview'
import Codex from '@/screens/Codex'
import Styleguide from '@/screens/styleguide/Styleguide'

/** No router: the current phase in the store decides which screen is shown. */
const SCREENS: Record<Phase, ComponentType> = {
  title: Title,
  destination: DestinationSelect,
  scenario: ScenarioSelect,
  role: RoleSelect,
  recruit: Recruit,
  planning: PlanningBoard,
  launch: LaunchCheck,
  mission: MissionControl,
  review: FailureReview,
  codex: Codex,
  styleguide: Styleguide,
}

export default function App() {
  const phase = useStore((s) => s.game.phase)
  const Screen = SCREENS[phase] ?? Title
  const reducedMotion = useSettings((s) => s.reducedMotion)
  // Each screen opens at the top (runs before a screen's own effects, e.g. Fix in Planning).
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])
  return (
    // Motion skips transform animations when the OS asks for less motion, or Settings does.
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <Starfield />
      <Screen />
      <Toaster />
    </MotionConfig>
  )
}
