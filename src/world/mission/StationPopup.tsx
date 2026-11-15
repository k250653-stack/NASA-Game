import type { Design, EngineContent, MissionState } from '@/engine/types'
import type { CrewMember } from '@/schemas'
import { computeTotals } from '@/engine/budget'
import type { WorkstationKind } from '../rooms/room'
import type { DayInfo, Gauge } from './missionRun'
import { AirlockPopup, CommsPopup, RepairsPopup, SciencePopup } from './StationPopups'
import {
  bonusStatus,
  commsInfo,
  crewAt,
  effectLines,
  evaLines,
  evaReady,
  partLines,
  scienceParts,
  stationComment,
} from './stationStatus'
import { ResourcesPopup } from './StatusPopups'

interface StationPopupProps {
  kind: WorkstationKind
  run: MissionState
  design: Design
  content: EngineContent
  team: readonly CrewMember[]
  gauges: Gauge[]
  day: DayInfo
  /** Stations currently needing attention (for the crew comment's mood). */
  alerts: readonly WorkstationKind[]
  scienceTarget: number
  trades: number
  onClose: () => void
}

/** Read-only info for the station the player used, with a line from whoever is posted there. */
export function StationPopup(props: StationPopupProps) {
  const { kind, run, design, content, team, onClose } = props
  const member = crewAt(kind, team, run)
  const talk = member && {
    member,
    line: stationComment(kind, props.alerts.includes(kind), run, member.id),
  }
  const contact = content.destinations.find((d) => d.id === design.destinationId)
  const contactHours =
    run.location === 'surface'
      ? (contact?.contactHoursPerDay ?? 0)
      : (contact?.transitContactHoursPerDay ?? 0)
  switch (kind) {
    case 'power':
      return (
        <ResourcesPopup
          run={run}
          design={design}
          gauges={props.gauges}
          talk={talk}
          onClose={onClose}
        />
      )
    case 'comms':
      return (
        <CommsPopup
          info={commsInfo(run, design, content, contactHours)}
          delayMin={props.day.delayMin}
          talk={talk}
          onClose={onClose}
        />
      )
    case 'science':
      return (
        <SciencePopup
          run={run}
          target={props.scienceTarget}
          instruments={scienceParts(partLines(run, design, content))}
          bonus={bonusStatus(run, design, content, props.trades)}
          talk={talk}
          onClose={onClose}
        />
      )
    case 'repair':
      return (
        <RepairsPopup
          parts={partLines(run, design, content)}
          spares={run.resources.spareKits}
          effects={effectLines(run, content)}
          talk={talk}
          onClose={onClose}
        />
      )
    case 'airlock':
      return (
        <AirlockPopup
          suits={run.resources.suits}
          suitsPacked={computeTotals(design, content).suitCount}
          evas={evaLines(run, content)}
          ready={evaReady(run, team)}
          talk={talk}
          onClose={onClose}
        />
      )
  }
}
