import { expect, test } from '@playwright/test'
import { checkScreen, DEMO_SEED, next, watch } from './helpers'

/**
 * Smoke test: plays through every phase with the real UI for each destination, at two viewport
 * sizes (see playwright.config.ts projects). Fails on any console error, uncaught exception,
 * failed /assets request (other than images/sounds that fall back to placeholders), or any
 * element that overflows the viewport horizontally.
 */

for (const destination of ['moon', 'mars'] as const) {
  test(`plays through every phase: ${destination}`, async ({ page }, info) => {
    const w = watch(page)
    const project = info.project.name
    const shot = (name: string) => checkScreen(page, w, `${destination}-${name}`, project)

    // Fresh save so every run starts at the title.
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await expect(page.getByTestId('start-mission-button')).toBeVisible()
    await shot('01-title')
    await page.getByTestId('start-mission-button').click()

    // Destination
    await expect(page.getByTestId('next-button')).toBeDisabled()
    await page.getByTestId(`destination-card-${destination}`).click()
    await expect(page.getByTestId(`destination-card-${destination}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await shot('02-destination')
    await next(page)

    // Scenario: pick the only scenario for this destination, then fix the seed.
    const scenario = page.locator('[data-testid^="scenario-card-"]')
    await expect(scenario).toHaveCount(1)
    await scenario.click()
    await page.getByTestId('seed-change').click()
    await page.getByTestId('seed-demo').click()
    await page.getByTestId('seed-set').click()
    await expect(page.getByTestId('seed-value')).toHaveText(`Seed: ${DEMO_SEED}`)
    await shot('03-scenario')
    await next(page)

    // Role
    await page.getByLabel('Callsign').fill('Eagle-1')
    await page.getByTestId('role-card-director').click()
    await shot('04-role')
    await next(page)

    // Recruit
    await expect(page.getByTestId('next-button')).toBeDisabled()
    await page.getByTestId('suggest-team-button').click()
    await expect(page.getByTestId('next-button')).toBeEnabled()
    await shot('05-recruit')
    await next(page)

    // Planning: the Director's proposed design passes the launch gate.
    await expect(page.getByTestId('planning-board')).toBeVisible()
    await shot('06-planning')
    await next(page)

    // Launch Check: poll, then launch (confirming risks if asked), then skip the sequence.
    await expect(page.getByTestId('final-call')).not.toHaveAttribute('data-call', 'NO-GO')
    await shot('07-launch')
    await next(page)
    const confirm = page.getByTestId('confirm-launch')
    const skip = page.getByTestId('skip-launch')
    await expect(confirm.or(skip)).toBeVisible()
    if (await confirm.isVisible()) await confirm.click()
    await skip.click()

    for (const [i, phase] of (['mission', 'review'] as const).entries()) {
      await expect(page.getByText(new RegExp(`Phase \\d+ / 10 · ${phase}`, 'i'))).toBeVisible()
      await shot(`${String(i + 8).padStart(2, '0')}-${phase}`)
      if (phase !== 'review') await next(page)
    }

    // Back works without losing choices.
    await page.getByTestId('back-button').click()
    await expect(page.getByText(/Phase \d+ \/ 10 · mission/i)).toBeVisible()
  })
}
