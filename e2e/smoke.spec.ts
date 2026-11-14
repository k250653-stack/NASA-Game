import { expect, test, type Page } from '@playwright/test'

/**
 * Smoke test: plays through every phase with the real UI for each destination, at two viewport
 * sizes (see playwright.config.ts projects). Fails on any console error, uncaught exception,
 * failed /assets request (other than images/sounds that fall back to placeholders), or any
 * element that overflows the viewport horizontally.
 */

const DEMO_SEED = '20261114'

/** Placeholder art and missing sounds are expected until real assets land. */
const EXPECTED_MISSING_ASSET =
  /\/assets\/(portraits|backgrounds|sprites|sounds|music)\/[^/]+\.(webp|mp3)$/

interface Watch {
  problems: string[]
}

function watch(page: Page): Watch {
  const w: Watch = { problems: [] }
  page.on('console', (msg) => {
    if (msg.type() === 'error') w.problems.push(`console error: ${msg.text()}`)
  })
  page.on('pageerror', (err) => w.problems.push(`uncaught exception: ${err.message}`))
  page.on('requestfailed', (req) => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/assets/') && !EXPECTED_MISSING_ASSET.test(url.pathname)) {
      w.problems.push(`request failed: ${url.pathname} (${req.failure()?.errorText})`)
    }
  })
  page.on('response', (res) => {
    const url = new URL(res.url())
    if (
      url.pathname.startsWith('/assets/') &&
      res.status() >= 400 &&
      !EXPECTED_MISSING_ASSET.test(url.pathname)
    ) {
      w.problems.push(`HTTP ${res.status()}: ${url.pathname}`)
    }
  })
  return w
}

/** Elements whose right edge sticks out past the viewport (ignoring scroll containers' children). */
async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const out: string[] = []
    if (document.documentElement.scrollWidth > vw + 1) {
      out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`)
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.right <= vw + 1) continue
      // Inside a scrollable container (tables, logs): allowed by the UI rules.
      let p = el.parentElement
      let scrolled = false
      while (p && p !== document.body) {
        const style = getComputedStyle(p)
        if (/(auto|scroll|hidden)/.test(style.overflowX)) {
          scrolled = true
          break
        }
        p = p.parentElement
      }
      if (!scrolled) {
        const name = `${el.tagName.toLowerCase()}${el.dataset.testid ? `[data-testid=${el.dataset.testid}]` : ''}.${String(el.className).slice(0, 60)}`
        out.push(`${name} right=${Math.round(r.right)} > ${vw}`)
      }
    }
    return out.slice(0, 10)
  })
}

async function checkScreen(page: Page, w: Watch, name: string, project: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0)) // sticky top bar would cover a scrolled heading
  await page.waitForTimeout(250) // let entrance animations settle
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true })
  expect(await horizontalOverflow(page), `horizontal overflow on ${name}`).toEqual([])
  expect(w.problems, `problems on ${name}`).toEqual([])
}

async function next(page: Page): Promise<void> {
  const button = page.getByTestId('next-button')
  await expect(button).toBeEnabled()
  await button.click()
}

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
    await page.getByTestId('role-card-science').click()
    await shot('04-role')
    await next(page)

    // Recruit
    await expect(page.getByTestId('next-button')).toBeDisabled()
    await page.getByTestId('suggest-team-button').click()
    await expect(page.getByTestId('next-button')).toBeEnabled()
    await shot('05-recruit')
    await next(page)

    // Stub and debug screens: they only need to render and navigate.
    for (const [i, phase] of (['planning', 'launch', 'mission', 'review'] as const).entries()) {
      await expect(page.getByText(new RegExp(`Phase \\d+ / 10 · ${phase}`, 'i'))).toBeVisible()
      await shot(`${String(i + 6).padStart(2, '0')}-${phase}`)
      if (phase !== 'review') await next(page)
    }

    // Back works without losing choices.
    await page.getByTestId('back-button').click()
    await expect(page.getByText(/Phase \d+ \/ 10 · mission/i)).toBeVisible()
  })
}
