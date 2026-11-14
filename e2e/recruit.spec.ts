import { expect, test, type Page } from '@playwright/test'
import { checkScreen, phase, playTo, watch } from './helpers'

async function recruit(page: Page, id: string): Promise<void> {
  await page.getByTestId(`crew-card-${id}`).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Recruit/ })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('budget updates when recruiting; an invalid team cannot continue', async ({ page }) => {
  await playTo(page, 'recruit')
  await expect(page.getByTestId('salaries')).toContainText('$0')
  await expect(page.getByTestId('next-button')).toBeDisabled()
  await expect(page.locator('#next-hint')).toHaveText('Recruit 3 more crew (0 of 3 seats filled).')
  await recruit(page, 'bilal') // $40M
  await expect(page.getByTestId('salaries')).toContainText('$40')
  await recruit(page, 'lin') // $50M
  await expect(page.getByTestId('salaries')).toContainText('$90')
  await expect(page.locator('#next-hint')).toHaveText('Recruit 1 more crew (2 of 3 seats filled).')
})

test('a team with no Practical crew shows the warning', async ({ page }, info) => {
  const w = watch(page)
  await playTo(page, 'recruit')
  await recruit(page, 'sana') // Thinker
  await recruit(page, 'lin') // Leader + Thinker
  await recruit(page, 'zara') // Leader
  await expect(page.getByTestId('balance-warnings')).toContainText(
    'Nobody on the team is Practical',
  )
  await checkScreen(page, w, 'recruit-no-practical', info.project.name)
})

test('Suggested team is valid, and progress survives a reload', async ({ page }) => {
  await playTo(page, 'recruit')
  await page.getByTestId('suggest-team-button').click()
  await expect(page.getByTestId('next-button')).toBeEnabled()
  await expect(page.locator('#next-hint')).toHaveCount(0)
  const salaries = (await page.getByTestId('salaries').innerText()).match(/\$(\d+)/)![1]!
  await page.reload()
  expect(await phase(page)).toBe('recruit')
  await expect(page.getByTestId('next-button')).toBeEnabled()
  await expect(page.getByTestId('salaries')).toContainText(`$${salaries}`)
})
