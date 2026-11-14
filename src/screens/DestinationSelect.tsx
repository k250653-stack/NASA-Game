import { PhaseShell } from '@/ui/PhaseShell'

export default function DestinationSelect() {
  return (
    <PhaseShell
      title="Choose a Destination"
      description="Pick the Moon or Mars. Shows transit time, signal delay, sunlight, gravity and hazards from destinations.json."
    />
  )
}
