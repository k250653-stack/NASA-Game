import { expect, test } from '@playwright/test'
import { checkScreen, watch } from './helpers'

/** The Dev UI kit screen shows every component, the Modal closes with Esc, focus is visible. */
test('styleguide renders every component, modal closes with Esc, focus ring visible', async ({
  page,
}, info) => {
  const w = watch(page)
  await page.goto('/?dev=1')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Dev: UI kit' }).click()

  for (const section of [
    'Tokens',
    'Controls',
    'Resource bars',
    'Navigation',
    'Overlays',
    'Card',
    'CrewCard',
    'PartCard',
    'Engine debug',
    'Simulate mission',
  ]) {
    await expect(page.getByRole('heading', { name: section, exact: true }), section).toBeVisible()
  }
  await expect(page.locator('[data-testid^="crew-card-"]')).toHaveCount(8)
  await expect(page.getByRole('radiogroup').first()).toBeVisible()

  const opener = page.getByRole('button', { name: 'Open modal' })
  await opener.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(
    await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')),
    'focus trapped',
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()

  // Keyboard focus shows the accent outline.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const s = getComputedStyle(el)
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }
  })
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThan(0)

  await checkScreen(page, w, 'styleguide', info.project.name)
})
