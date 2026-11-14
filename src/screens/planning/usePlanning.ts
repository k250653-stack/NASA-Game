import { useEffect, useMemo } from 'react'
import { getContent } from '@/content/load'
import { candidates, playerCharacterId, playerRoleOf } from '@/engine/recruitment'
import { editDesign, proposeInitialDesign, type DesignChange } from '@/engine/planning'
import { createRng } from '@/engine/rng'
import type { Design } from '@/engine/types'
import type { CrewMember } from '@/schemas'
import { useStore } from '@/store'
import { emitConcept } from '@/store/concepts'
import { toast } from '@/ui/uiStore'

/**
 * Builds the engine Design from the store, creates the AI teammates' first proposal when the
 * run's inputs change, and applies edits through the engine (which enforces ownership).
 */
export function usePlanning() {
  const content = getContent()
  const destinationId = useStore((s) => s.game.destinationId)
  const scenarioId = useStore((s) => s.game.scenarioId)
  const seat = useStore((s) => s.game.roleChoice)
  const difficulty = useStore((s) => s.game.difficulty)
  const seed = useStore((s) => s.game.seed)
  const callsign = useStore((s) => s.game.callsign)
  const recruitedIds = useStore((s) => s.crew.recruitedIds)
  const stored = useStore((s) => s.design)
  const setPlanningDesign = useStore((s) => s.setPlanningDesign)

  const scenario = content.scenarios.find((s) => s.id === scenarioId)
  const destination = content.destinations.find((d) => d.id === destinationId)
  const team: CrewMember[] = useMemo(
    () => candidates(content).filter((m) => recruitedIds.includes(m.id)),
    [content, recruitedIds],
  )
  const signature = `${scenarioId}|${seat}|${difficulty}|${recruitedIds.join(',')}|${seed}`
  const ready = Boolean(scenario && destination && seat)

  // New run inputs -> new proposal from the AI teammates (seeded, so it is repeatable).
  useEffect(() => {
    if (!scenario || !destination || !seat || stored.signature === signature) return
    const d = proposeInitialDesign(
      { scenario, destination, crew: team, seat, difficulty },
      content,
      createRng(seed),
    )
    setPlanningDesign(
      {
        partIds: d.partIds,
        rocketId: d.rocketId,
        supplies: d.supplies,
        standingOrders: d.standingOrders,
      },
      signature,
    )
  }, [
    scenario,
    destination,
    seat,
    difficulty,
    seed,
    team,
    signature,
    stored.signature,
    content,
    setPlanningDesign,
  ])

  const design: Design | null =
    ready && scenario && seat && stored.signature === signature
      ? {
          destinationId: scenario.destinationId,
          scenarioId: scenario.id,
          rocketId: stored.rocketId,
          partIds: stored.partIds,
          supplies: stored.supplies,
          crewIds: [playerCharacterId(seat), ...recruitedIds],
          standingOrders: stored.standingOrders ?? scenario.defaultStandingOrders,
          playerRole: playerRoleOf(seat),
          difficulty,
        }
      : null

  /** Saves an engine-produced design back to the store. */
  const save = (d: Design) =>
    setPlanningDesign({
      partIds: d.partIds,
      rocketId: d.rocketId,
      supplies: d.supplies,
      standingOrders: d.standingOrders,
    })

  /** Applies one of the player's own edits (the engine refuses edits outside the seat). */
  const edit = (change: DesignChange) => {
    if (!design || !seat) return
    const r = editDesign(design, seat, change, content)
    if (r.refused) {
      toast.warning('Not your call', r.refused)
      return
    }
    save(r.design)
    const category = (id: string) => content.parts.find((p) => p.id === id)?.category
    const touched =
      change.kind === 'swapPart'
        ? [change.fromId, change.toId]
        : change.kind === 'addPart' || change.kind === 'removePart'
          ? [change.partId]
          : []
    if (touched.some((id) => category(id) === 'battery')) emitConcept('power_dark')
    if (touched.some((id) => category(id) === 'comms')) emitConcept('data_downlink')
    if (change.kind === 'supply') emitConcept('life_support')
    if (change.kind === 'rocket') emitConcept('launch_capacity')
  }

  return { content, design, seat, team, scenario, destination, difficulty, callsign, edit, save }
}
