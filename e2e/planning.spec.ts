import { expect, test, type Page } from '@playwright/test'
import { checkScreen, next, playTo, watch, type Seat } from './helpers'

/** Mass bar numbers, e.g. "9,250 / 8,000 kg" -> 9250. */
async function massKg(page: Page): Promise<number> {
  const text = await page.getByTestId('gauge-mass').innerText()
  const m = text.match(/([\d,]+)\s*\/\s*([\d,]+)/)
  return Number(m![1]!.replace(/,/g, ''))
}
async function massCapacity(page: Page): Promise<number> {
  const text = await page.getByTestId('gauge-mass').innerText()
  const m = text.match(/([\d,]+)\s*\/\s*([\d,]+)/)
  return Number(m![2]!.replace(/,/g, ''))
}

const RUNS: Array<{ destination: 'moon' | 'mars'; seat: Seat }> = [
  ...(['science', 'power_life', 'comms_nav', 'launch_budget', 'director'] as const).map((seat) => ({
    destination: 'moon' as const,
    seat,
  })),
  { destination: 'mars', seat: 'science' },
  { destination: 'mars', seat: 'director' },
]

for (const { destination, seat } of RUNS) {
  test(`planning board: ${destination} as ${seat}`, async ({ page }, info) => {
    const w = watch(page)
    await playTo(page, 'planning', { destination, seat })
    await expect(page.getByTestId('readiness-chip')).toBeVisible()
    await expect(page.getByTestId('gauge-mass')).toHaveAttribute('data-status', /ok|warn|fail/)
    const level = await page.getByTestId('readiness-chip').getAttribute('data-level')
    if (seat !== 'director') expect(level).toBe('red') // Engineer proposals start over a limit

    // Standing orders only on Mars.
    await expect(page.getByTestId('standing-orders')).toHaveCount(destination === 'mars' ? 1 : 0)

    if (seat !== 'director') {
      await page.locator('[data-testid^="teammate-card-"]').first().click()
      const ask = page.getByTestId('trade-ask')
      expect(await ask.locator('option').count()).toBeGreaterThan(1)
      await ask.selectOption({ index: 1 })
      await page.getByTestId('propose-trade').click()
      await expect(page.getByTestId('trade-response')).toHaveAttribute(
        'data-verdict',
        /accept|counter|refuse/,
      )
      await checkScreen(page, w, `planning-${destination}-${seat}-trade`, info.project.name)
      await page.keyboard.press('Escape')
    }
    await checkScreen(page, w, `planning-${destination}-${seat}`, info.project.name)
    await next(page)
    await expect(page.getByText(/Phase \d+ \/ 10 · launch/i)).toBeVisible()
  })
}

test('ownership: only your seat is editable, others are locked with the owner named', async ({
  page,
}) => {
  await playTo(page, 'planning', { seat: 'science' })
  const catalog = page.getByTestId('catalog-panel')
  await expect(catalog.getByTestId('add-sample-lab')).toBeVisible() // own tab first
  await catalog.getByRole('tab', { name: /Power & Life Support/ }).click()
  await expect(catalog.getByText('Owned by Sana Rahimi').first()).toBeVisible()
  await expect(catalog.getByTestId('add-battery-li-50kwh')).toHaveCount(0)
  await catalog.getByText('Owned by Sana Rahimi').first().hover()
  await expect(page.getByRole('tooltip')).toContainText('Owned by Sana Rahimi')
  await expect(page.getByLabel('Water in days')).toBeDisabled()
  await expect(page.getByTestId('rocket-card-heavy-lunar-launcher')).toBeDisabled()
})

test('Mission Director can edit everything', async ({ page }) => {
  await playTo(page, 'planning', { seat: 'director' })
  const catalog = page.getByTestId('catalog-panel')
  for (const tab of [/Power & Life Support/, /Comms & Navigation/]) {
    await catalog.getByRole('tab', { name: tab }).click()
    await expect(catalog.getByText(/^Owned by/)).toHaveCount(0)
  }
  await expect(page.getByLabel('Food in days')).toBeEnabled()
  await expect(page.getByTestId('rocket-card-heavy-lunar-launcher')).toBeEnabled()
  await expect(page.locator('[data-testid^="teammate-card-"]')).toHaveCount(0)
})

test('supplies slider changes days of supply (Power & Life seat)', async ({ page }) => {
  await playTo(page, 'planning', { seat: 'power_life' })
  const readout = page.getByTestId('supply-days')
  await expect(readout).toContainText('Lasts 37 of 37')
  // Cutting food to 20 days makes food the limiting supply: the readout drops to 20.
  await page.getByLabel('Food in days').fill('20')
  await expect(readout).toContainText('Lasts 20 of 37')
  await expect(page.getByTestId('supplies-panel')).toContainText('Food · runs out first')
})

test('rocket change updates the mass bar (Launch & Budget seat)', async ({ page }) => {
  await playTo(page, 'planning', { seat: 'launch_budget' })
  const capBefore = await massCapacity(page)
  await page.getByTestId('rocket-card-heavy-lunar-launcher').click()
  await expect.poll(() => massCapacity(page)).toBe(20000)
  expect(capBefore).not.toBe(20000)
  await expect(page.getByTestId('gauge-mass')).toHaveAttribute('data-status', 'ok')
})

test('an accepted trade changes the margins', async ({ page }, info) => {
  const w = watch(page)
  await playTo(page, 'planning', { seat: 'science' })
  const before = await massKg(page)
  await page.getByTestId('teammate-card-sana').click()
  // The engine accepts swapping the rigid habitat for the inflatable one (−2,800 kg).
  const ask = page.getByTestId('trade-ask')
  const label = await ask.locator('option', { hasText: 'Inflatable Habitat' }).first().innerText()
  await ask.selectOption({ label })
  await page.getByTestId('propose-trade').click()
  await expect(page.getByTestId('trade-response')).toHaveAttribute('data-verdict', 'accept')
  await checkScreen(page, w, 'planning-trade-accepted', info.project.name)
  await page.keyboard.press('Escape')
  await expect.poll(() => massKg(page)).toBe(before - 2800)
})
