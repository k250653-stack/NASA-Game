import { expect, test } from '@playwright/test'
import { watch } from './helpers'

/** Main menu: mouse and keyboard, Continue needs a save, settings survive a reload. */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('mouse: hover highlights, Play goes to destination, styleguide hidden', async ({ page }) => {
  const w = watch(page)
  await expect(page.getByRole('button', { name: 'Dev: UI kit' })).toHaveCount(0)
  const sandbox = page.getByTestId('menu-sandbox')
  await sandbox.hover()
  await expect(sandbox).toBeFocused()
  await page.getByTestId('start-mission-button').click()
  await expect(page.getByTestId('destination-card-moon')).toBeVisible()
  expect(w.problems).toEqual([])
})

test('keyboard: arrows skip disabled Continue, Enter selects', async ({ page }) => {
  await expect(page.getByTestId('start-mission-button')).toBeFocused()
  await expect(page.getByTestId('menu-continue')).toBeDisabled()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('menu-sandbox')).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('menu-about')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'About the event' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Continue is enabled once a mission is saved and resumes it', async ({ page }) => {
  await page.getByTestId('start-mission-button').click()
  await page.getByTestId('destination-card-mars').click()
  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('main-menu')).toBeVisible()
  const cont = page.getByTestId('menu-continue')
  await expect(cont).toBeEnabled()
  await cont.click()
  await expect(page.getByTestId('destination-card-mars')).toHaveAttribute('aria-pressed', 'true')
})

test('Play with a save asks first; Cancel keeps it, Start new wipes it', async ({ page }) => {
  await page.getByTestId('start-mission-button').click()
  await page.getByTestId('destination-card-mars').click()
  await page.getByTestId('back-button').click()

  await page.getByTestId('start-mission-button').click()
  const dialog = page.getByRole('dialog', { name: 'Start a new mission?' })
  await expect(dialog).toContainText('Your current progress will be lost.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('menu-continue')).toBeEnabled()

  await page.getByTestId('start-mission-button').click()
  await page.getByTestId('confirm-new-game').click()
  await expect(page.getByTestId('destination-card-mars')).toHaveAttribute('aria-pressed', 'false')
})

test('Sandbox mode pre-picks the Mission Director seat', async ({ page }) => {
  await page.getByTestId('menu-sandbox').click()
  await page.getByTestId('destination-card-moon').click()
  await page.getByTestId('next-button').click()
  await page.locator('[data-testid^="scenario-card-"]').click()
  await page.getByTestId('next-button').click()
  await expect(page.getByTestId('role-card-director')).toHaveAttribute('aria-pressed', 'true')
})

test('settings persist across a reload', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  const music = page.getByTestId('setting-music')
  const motion = page.getByTestId('setting-reduced-motion')
  await expect(music).toHaveAttribute('aria-checked', 'true')
  await music.click()
  await motion.click()
  await page.reload()
  await page.getByTestId('menu-settings').click()
  await expect(page.getByTestId('setting-music')).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('setting-reduced-motion')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('setting-sound')).toHaveAttribute('aria-checked', 'true')
})
