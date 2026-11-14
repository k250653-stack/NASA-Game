import { expect, test } from '@playwright/test'
import { checkScreen, next, phase, playTo, watch } from './helpers'

test('destination: Continue disabled until chosen; switching later asks and resets choices', async ({
  page,
}, info) => {
  const w = watch(page)
  await playTo(page, 'destination')
  await expect(page.getByTestId('next-button')).toBeDisabled()
  await expect(page.locator('#next-hint')).toHaveText('Pick a destination to continue.')

  await page.getByTestId('destination-card-moon').click()
  await next(page)
  await page.locator('[data-testid^="scenario-card-"]').click()
  await page.getByTestId('back-button').click()

  // Switching destination after progress: confirm, keep, then switch and reset.
  await page.getByTestId('destination-card-mars').click()
  await expect(page.getByRole('dialog')).toContainText('Switch to Mars')
  await page.getByRole('button', { name: 'Keep current' }).click()
  await expect(page.getByTestId('destination-card-moon')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('destination-card-mars').click()
  await page.getByRole('button', { name: 'Switch and reset' }).click()
  await expect(page.getByTestId('destination-card-mars')).toHaveAttribute('aria-pressed', 'true')
  await next(page)
  await expect(page.getByTestId('scenario-card-jezero-long-stay')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByTestId('next-button')).toBeDisabled()
  await checkScreen(page, w, 'selection-destination-reset', info.project.name)
})

test('scenario: difficulty and a typed seed persist across a reload', async ({ page }) => {
  await playTo(page, 'scenario')
  await page.locator('[data-testid^="scenario-card-"]').click()
  await page.getByRole('radio', { name: 'Flight Director' }).click()
  await expect(page.getByText('Tight budget, more events, hints off.')).toBeVisible()
  await page.getByTestId('seed-change').click()
  await page.locator('#seed-input').fill('12345')
  await page.getByTestId('seed-set').click()
  await page.reload()
  expect(await phase(page)).toBe('scenario')
  await expect(page.getByRole('radio', { name: 'Flight Director' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('seed-value')).toHaveText('Seed: 12345')
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('role: every seat can be chosen; callsign is capped at 16 and validated', async ({
  page,
}, info) => {
  const w = watch(page)
  await playTo(page, 'role')
  for (const seat of ['science', 'power_life', 'comms_nav', 'launch_budget', 'director']) {
    await page.getByTestId(`role-card-${seat}`).click()
    await expect(page.getByTestId(`role-card-${seat}`)).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(page.getByTestId('role-card-director')).toContainText('Sandbox')

  const callsign = page.getByLabel('Callsign')
  await callsign.fill('ABCDEFGHIJKLMNOPQRSTU') // 21 characters
  await expect(callsign).toHaveValue('ABCDEFGHIJKLMNOP') // 16
  await callsign.fill('bad<name>')
  await expect(page.locator('#next-hint')).toHaveText('Use letters, digits, spaces, - or _ only.')
  await expect(page.getByTestId('next-button')).toBeDisabled()
  await callsign.fill('Eagle-1')
  await expect(page.getByTestId('next-button')).toBeEnabled()
  await checkScreen(page, w, 'selection-role', info.project.name)
})
