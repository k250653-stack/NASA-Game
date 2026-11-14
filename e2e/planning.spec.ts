import { expect, test, type Page } from '@playwright/test'
import { checkScreen, DEMO_SEED, next, watch } from './helpers'

/**
 * Planning Board: for each seat, play to the board with the real UI, check it renders with live
 * margins and readiness, propose one trade to a teammate (not the Mission Director), and
 * continue to the Launch Check.
 */

const RUNS = [
  ...(['science', 'power_life', 'comms_nav', 'launch_budget', 'director'] as const).map((seat) => ({
    destination: 'moon' as const,
    seat,
  })),
  { destination: 'mars' as const, seat: 'science' as const },
  { destination: 'mars' as const, seat: 'director' as const },
]

async function playToPlanning(page: Page, destination: string, seat: string): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('start-mission-button').click()
  await page.getByTestId(`destination-card-${destination}`).click()
  await next(page)
  await page.locator('[data-testid^="scenario-card-"]').click()
  await page.getByTestId('seed-change').click()
  await page.getByTestId('seed-demo').click()
  await page.getByTestId('seed-set').click()
  await expect(page.getByTestId('seed-value')).toHaveText(`Seed: ${DEMO_SEED}`)
  await next(page)
  await page.getByTestId(`role-card-${seat}`).click()
  await next(page)
  await page.getByTestId('suggest-team-button').click()
  await next(page)
}

for (const { destination, seat } of RUNS) {
  test(`planning board: ${destination} as ${seat}`, async ({ page }, info) => {
    const w = watch(page)
    await playToPlanning(page, destination, seat)

    await expect(page.getByTestId('planning-board')).toBeVisible()
    await expect(page.getByTestId('readiness-chip')).toBeVisible()
    await expect(page.getByTestId('gauge-mass')).toHaveAttribute('data-status', /ok|warn|fail/)
    // Engineer proposals with AI teammates start over a limit; the Mission Director's fits.
    const level = await page.getByTestId('readiness-chip').getAttribute('data-level')
    if (seat !== 'director') expect(level).toBe('red')

    if (seat !== 'director') {
      await page.locator('[data-testid^="teammate-card-"]').first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      const ask = page.getByTestId('trade-ask')
      const options = await ask.locator('option').count()
      expect(options, 'teammate has something to ask for').toBeGreaterThan(1)
      await ask.selectOption({ index: 1 })
      await page.getByTestId('propose-trade').click()
      await expect(page.getByTestId('trade-response')).toBeVisible()
      await expect(page.getByTestId('trade-response')).toHaveAttribute(
        'data-verdict',
        /accept|counter|refuse/,
      )
      await checkScreen(page, w, `planning-${destination}-${seat}-trade`, info.project.name)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }

    await checkScreen(page, w, `planning-${destination}-${seat}`, info.project.name)
    await next(page)
    await expect(page.getByText(/Phase \d+ \/ 10 · launch/i)).toBeVisible()
  })
}
