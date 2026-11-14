import { z } from 'zod'

/**
 * Orders the crew follow when Earth cannot answer in time (Mars signal delay) and that steer
 * AI teammates everywhere.
 */
export const StandingOrdersSchema = z.strictObject({
  /** Battery running flat: drop science loads, send an EVA to repair, or ride it out. */
  powerEmergency: z.enum(['shed_science', 'repair_eva', 'wait']),
  /** Injured crew: rest them, or keep them working. */
  crewInjury: z.enum(['rest', 'continue']),
  /** Supplies won't last: ration food, or cut the surface stay short. */
  lowSupplies: z.enum(['ration', 'abort_early']),
  /** Who may go outside: only Practical crew, the best person, or nobody. */
  eva: z.enum(['only_practical', 'best_available', 'never']),
})

export type StandingOrders = z.infer<typeof StandingOrdersSchema>
