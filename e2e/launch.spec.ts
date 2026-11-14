import { expect, test } from '@playwright/test'
import { checkScreen, next, phase, playTo, watch } from './helpers'

/** Launch Check gate, go/no-go poll and the launch sequence. */

test('a valid design launches and reaches the mission phase', async ({ page }, info) => {
  const w = watch(page)
  await playTo(page, 'launch', { seat: 'director' })
  await expect(page.getByTestId('launch-check')).toBeVisible()
  await expect(page.getByTestId('final-call')).not.toHaveAttribute('data-call', 'NO-GO')
  for (const role of ['launch_budget', 'power_life', 'comms_nav', 'science'])
    await expect(page.getByTestId(`poll-${role}`)).toBeVisible()
  await checkScreen(page, w, 'launch-valid', info.project.name)
  await next(page)
  const confirm = page.getByTestId('confirm-launch')
  await expect(confirm.or(page.getByTestId('launch-sequence'))).toBeVisible()
  if (await confirm.isVisible()) await confirm.click()
  await expect(page.getByTestId('launch-sequence')).toBeVisible()
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe('mission')
})

test('an over-mass design is NO-GO with Launch disabled and the reason shown', async ({
  page,
}, info) => {
  const w = watch(page)
  await playTo(page, 'launch', { seat: 'science' })
  await expect(page.getByTestId('check-mass')).toHaveAttribute('data-status', 'fail')
  await expect(page.getByTestId('final-call')).toHaveAttribute('data-call', 'NO-GO')
  await expect(page.getByTestId('next-button')).toBeDisabled()
  await expect(page.getByText(/No-go:/)).toBeVisible()
  await expect(page.getByTestId('poll-science')).toContainText('Your call')
  await checkScreen(page, w, 'launch-nogo', info.project.name)
})

test('a warn-only design needs the confirm modal', async ({ page }) => {
  await playTo(page, 'planning', { seat: 'director' })
  await page.getByLabel('Food in days').fill('35')
  await next(page)
  await expect(page.getByTestId('final-call')).toHaveAttribute('data-call', 'GO WITH RISKS')
  await next(page)
  await expect(page.getByTestId('risk-list')).toBeVisible()
  await expect(page.getByTestId('launch-sequence')).toHaveCount(0)
  await page.getByTestId('confirm-launch').click()
  await expect(page.getByTestId('launch-sequence')).toBeVisible()
})

test('Fix in Planning returns to Planning with the panel focused', async ({ page }) => {
  await playTo(page, 'launch', { seat: 'science' })
  await page.getByTestId('fix-mass').click()
  await expect(page.getByTestId('planning-board')).toBeVisible()
  await expect(page.locator('#panel-launcher')).toBeFocused()
})

test('Skip ends the launch sequence immediately', async ({ page }) => {
  await playTo(page, 'launch', { seat: 'director' })
  await next(page)
  const confirm = page.getByTestId('confirm-launch')
  await expect(confirm.or(page.getByTestId('launch-sequence'))).toBeVisible()
  if (await confirm.isVisible()) await confirm.click()
  await expect(page.getByTestId('countdown')).toBeVisible()
  await page.getByTestId('skip-launch').click()
  await expect.poll(() => phase(page), { timeout: 2_000 }).toBe('mission')
})

test('reduced motion plays no long animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await playTo(page, 'launch', { seat: 'director' })
  await next(page)
  const confirm = page.getByTestId('confirm-launch')
  await expect(confirm.or(page.getByTestId('launch-sequence'))).toBeVisible()
  if (await confirm.isVisible()) await confirm.click()
  await expect(page.getByTestId('launch-sequence')).toHaveAttribute('data-stage', 'reduced')
  await expect(page.getByTestId('countdown')).toHaveCount(0)
  await expect.poll(() => phase(page), { timeout: 3_000 }).toBe('mission')
})
