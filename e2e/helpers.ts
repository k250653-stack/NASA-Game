import { expect, type Page } from '@playwright/test'

/** Shared e2e helpers: problem watcher, overflow check, screenshots, navigation. */

export const DEMO_SEED = '20261114'

/** Placeholder art and missing sounds are expected until real assets land. */
const EXPECTED_MISSING_ASSET =
  /\/assets\/(portraits|backgrounds|sprites|sounds|music)\/[^/]+\.(webp|mp3)$/

export interface Watch {
  problems: string[]
}

export function watch(page: Page): Watch {
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
export async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const out: string[] = []
    if (document.documentElement.scrollWidth > vw + 1) {
      out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`)
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.right <= vw + 1) continue
      // Fixed overlays (toasts, modals) slide in from the edge and are not page layout.
      if (el.closest('[data-overlay]') || getComputedStyle(el).position === 'fixed') continue
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

export async function checkScreen(
  page: Page,
  w: Watch,
  name: string,
  project: string,
): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0)) // sticky top bar would cover a scrolled heading
  await page.waitForTimeout(250) // let entrance animations settle
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true })
  expect(await horizontalOverflow(page), `horizontal overflow on ${name}`).toEqual([])
  expect(w.problems, `problems on ${name}`).toEqual([])
}

export async function next(page: Page): Promise<void> {
  const button = page.getByTestId('next-button')
  await expect(button).toBeEnabled()
  await button.click()
}
