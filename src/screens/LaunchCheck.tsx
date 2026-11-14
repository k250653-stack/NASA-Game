import { PhaseShell } from '@/ui/PhaseShell'

export default function LaunchCheck() {
  return (
    <PhaseShell
      title="Launch Check"
      description="Go / no-go review: does the design fit the rocket, close the power budget and keep the crew alive? NOVA lessons open here."
      nextLabel="Launch"
    />
  )
}
