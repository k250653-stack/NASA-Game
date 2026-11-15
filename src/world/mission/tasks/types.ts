/** What every hands-on task receives. */
export interface TaskProps {
  /** Seed for the layout (shuffles, target positions): the seeded rng, never Math.random. */
  seed: number
  /** The task is done. */
  onComplete: () => void
  /** The task can no longer be done (e.g. out of tries): counts as giving up. */
  onFail: () => void
}
