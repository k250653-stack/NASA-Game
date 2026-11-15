import { lazy, Suspense, useEffect, useLayoutEffect, type ComponentType } from 'react'
import { MotionConfig } from 'motion/react'
import { useStore, type Phase } from '@/store'
import { Starfield } from '@/ui/Starfield'
import { Toaster } from '@/ui/Toaster'
import { NovaLayer } from '@/nova/NovaLayer'
import { setMusicTrack } from '@/ui/sound'
import { LoadingScreen } from '@/ui/LoadingScreen'
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
  const crt = useSettings((s) => s.crt)
  // A station popup shows the phase's screen inside the HQ world instead of full screen.
  const popup = useWorld((s) => s.popup)
  // The debrief (phase review) is a popup over the HQ Briefing room.
  const inWorld = phase === 'hq' || phase === 'review' || popup !== null
  // Scene music: an mp3 if present, else the generated drone. Starts after the first click.
  const track =
    phase === 'title'
      ? 'menu'
      : phase === 'mission'
        ? 'mission'
        : phase === 'review'
          ? 'debrief'
          : inWorld
            ? 'hq'
            : 'menu'
  useEffect(() => setMusicTrack(track), [track])
  // Each screen opens at the top (runs before a screen's own effects, e.g. Fix in Planning).
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])
  return (
    // Motion skips transform animations when the OS asks for less motion, or Settings does.
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <Starfield />
      <Suspense fallback={<LoadingScreen progress={0} />}>
        {inWorld ? (
          <HQWorld popup={phase !== 'hq' && phase !== 'review' ? <Screen /> : null} />
        ) : (
          <Screen />
        )}
      </Suspense>
      <NovaLayer />
      <LoadingScreen />
      {crt && <div className="crt-overlay pointer-events-none fixed inset-0 z-[95]" aria-hidden />}
      <Toaster />
    </MotionConfig>
  )
}
