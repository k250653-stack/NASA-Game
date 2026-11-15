/**
 * The player's current design read straight from the store (no AI proposal side effects, unlike
 * usePlanning). Null until a scenario, seat and plan exist.
 */
import { getContent } from '@/content/load'
import { playerCharacterId, playerRoleOf } from '@/engine/recruitment'
import type { Design } from '@/engine/types'
import { useStore } from '@/store'

export function currentDesign(): Design | null {
  const { game, crew, design } = useStore.getState()
  const scenario = getContent().scenarios.find((s) => s.id === game.scenarioId)
  const seat = game.roleChoice
  if (!scenario || !seat || design.partIds.length === 0) return null
  return {
    destinationId: scenario.destinationId,
    scenarioId: scenario.id,
    rocketId: design.rocketId,
    partIds: design.partIds,
    supplies: design.supplies,
    crewIds: [playerCharacterId(seat), ...crew.recruitedIds],
    standingOrders: design.standingOrders ?? scenario.defaultStandingOrders,
    playerRole: playerRoleOf(seat),
    difficulty: game.difficulty,
  }
}
