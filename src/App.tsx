import type { ComponentType } from 'react'
import { useStore, type Phase } from '@/store'
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
}

export default function App() {
  const phase = useStore((s) => s.game.phase)
  const Screen = SCREENS[phase]
  return (
    <div className="min-h-full text-slate-200">
      <Screen />
    </div>
  )
}
