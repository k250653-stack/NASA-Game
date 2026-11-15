/**
 * Watchable walkthrough: plays the whole game like a person (held keys, real clicks), with a
 * caption bar explaining each step. Headed, 1600x900, human pauses, video to e2e/walkthrough-video/.
 * Run: pnpm walkthrough. Navigation only READS the player position the game saves to
 * localStorage and the on-screen "E · …" prompt; it never teleports or calls game code.
 * Anything that blocks the run is logged as BLOCKER in docs/NOTES-FOR-REVIEW.md.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const BASE = process.env.WALK_URL ?? 'http://localhost:5173'
const VIDEO_DIR = path.join('e2e', 'walkthrough-video')
const NOTES = path.join('docs', 'NOTES-FOR-REVIEW.md')
const SHOTS = path.join('docs', 'review-shots')
/**
 * Walk speed in the game (HQScene WALK_SPEED, px/s). No Playwright slowMo: it delays every key
 * press and release, which makes held-key walking unpredictable. The script pauses itself instead.
 */
const SPEED = 90
/** Shortest key hold, ms (shorter taps barely move the astronaut). */
const MIN_HOLD = 150
/** Where a new game puts the player: the centre of the lobby floor (hq-lobby.json walkable). */
const LOBBY_SPAWN: [number, number] = [691, 485]

test.use({
  // WALK_HEADLESS=1 for debugging the route without a window; the normal run is visible.
  headless: process.env.WALK_HEADLESS === '1',
  viewport: { width: 1600, height: 900 },
  video: { mode: 'on', size: { width: 1600, height: 900 } },
})
test.describe.configure({ mode: 'serial' })

// ---- dev server ------------------------------------------------------------------------------

let server: ChildProcess | null = null
async function up(): Promise<boolean> {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}
test.beforeAll(async () => {
  test.setTimeout(120_000)
  if (await up()) return
  server = spawn('pnpm', ['dev', '--port', '5173', '--strictPort'], { shell: true, stdio: 'ignore' })
  for (let i = 0; i < 100 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1000))
})
test.afterAll(() => {
  server?.kill()
})

// ---- helpers -----------------------------------------------------------------------------------

type Pt = [number, number]
const blockers: string[] = []
const ugly: string[] = []

async function caption(page: Page, text: string) {
  console.log(`▶ ${text}`)
  await page.evaluate((t) => {
    let el = document.getElementById('walkthrough-caption')
    if (!el) {
      el = document.createElement('div')
      el.id = 'walkthrough-caption'
      Object.assign(el.style, {
        position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483647',
        padding: '10px 18px', background: 'rgba(6,10,19,0.92)', color: '#f5a524',
        font: '600 20px "Barlow Condensed", "Arial Narrow", sans-serif', letterSpacing: '0.08em',
        textTransform: 'uppercase', borderTop: '2px solid #5b6880', pointerEvents: 'none',
      })
      document.body.appendChild(el)
    }
    el.textContent = t
  }, text)
}

const pause = (page: Page, ms = 1000) => page.waitForTimeout(ms)

async function blocker(page: Page, msg: string) {
  const n = blockers.length + 1
  fs.mkdirSync(SHOTS, { recursive: true })
  const shot = path.join(SHOTS, `blocker-${n}.png`)
  await page.screenshot({ path: shot }).catch(() => {})
  blockers.push(`- **BLOCKER:** ${msg} ([screenshot](review-shots/blocker-${n}.png))`)
  console.log(`🐞 BLOCKER: ${msg}`)
}

async function note(page: Page, msg: string) {
  const n = ugly.length + 1
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `ugly-${n}.png`) }).catch(() => {})
  ugly.push(`- ${msg} ([screenshot](review-shots/ugly-${n}.png))`)
  console.log(`👀 ${msg}`)
}

async function visible(page: Page, testId: string, timeout = 0): Promise<boolean> {
  const l = page.getByTestId(testId).first()
  if (timeout) return l.waitFor({ state: 'visible', timeout }).then(() => true, () => false)
  return l.isVisible().catch(() => false)
}

/** Lets NOVA finish: Enter through tutorial lines; answers and closes any open lesson. */
async function nova(page: Page) {
  for (let i = 0; i < 12; i++) {
    if (await visible(page, 'nova-lesson')) {
      await caption(page, 'NOVA has a lesson: reading the question first')
      await pause(page, 2000)
      await page.getByTestId('nova-predict-1').click()
      await caption(page, 'Reading the explanation, the visual and "Apply to your mission"')
      await pause(page, 2500)
      const slider = page.getByTestId('nova-viz-slider')
      if (await slider.isVisible().catch(() => false)) {
        await slider.focus()
        for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight')
      }
      await page.getByTestId('nova-apply').scrollIntoViewIfNeeded().catch(() => {})
      await pause(page, 3000)
      await page.getByTestId('nova-lesson-skip').click()
      await pause(page)
      continue
    }
    if (await visible(page, 'nova-bubble')) {
      await pause(page, 1500)
      await page.keyboard.press('Enter')
      continue
    }
    return
  }
}

async function playerPos(page: Page): Promise<Pt | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('mission-control-world')
      const p = raw ? (JSON.parse(raw) as { state?: { playerPos?: [number, number] | null } }).state?.playerPos : null
      return p ?? null
    } catch {
      return null
    }
  })
}

async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k)
  await page.waitForTimeout(Math.max(MIN_HOLD, ms))
  for (const k of keys) await page.keyboard.up(k)
}

/**
 * Walks to a world point with held arrow keys, correcting from the saved position.
 * Returns 'arrived', 'portal' (went through a door: position jumped) or 'stuck'.
 */
async function walkTo(page: Page, target: Pt, tol = 16): Promise<'arrived' | 'portal' | 'stuck'> {
  let last = await playerPos(page)
  for (let i = 0; i < 14; i++) {
    // Nothing is saved until the player first moves: start from the lobby spawn (floor centre).
    const p = (await playerPos(page)) ?? last ?? LOBBY_SPAWN
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) > 260) return 'portal'
    last = p
    if (process.env.WALK_DEBUG) console.log(`   pos ${JSON.stringify(p)} -> ${JSON.stringify(target)}`)
    const dx = target[0] - p[0]
    const dy = target[1] - p[1]
    if (Math.hypot(dx, dy) <= tol) return 'arrived'
    const h = Math.abs(dx) > 4 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null
    const v = Math.abs(dy) > 4 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : null
    const diag = Math.min(Math.abs(dx), Math.abs(dy))
    if (h && v && diag > 6) await hold(page, [h, v], Math.min(2500, (diag * Math.SQRT2 * 1000) / SPEED))
    const restX = Math.abs(dx) - (h && v ? diag : 0)
    const restY = Math.abs(dy) - (h && v ? diag : 0)
    if (h && restX > 4) await hold(page, [h], Math.min(2500, (restX * 1000) / SPEED))
    if (v && restY > 4) await hold(page, [v], Math.min(2500, (restY * 1000) / SPEED))
    await pause(page, 1150) // the game saves the position about once a second
  }
  return 'stuck'
}

/** Follows waypoints; the last one may be a door (portal expected). */
async function route(page: Page, label: string, points: Pt[], door = false): Promise<boolean> {
  for (let i = 0; i < points.length; i++) {
    const r = await walkTo(page, points[i]!, i === points.length - 1 && door ? 10 : 18)
    if (r === 'portal') {
      await pause(page, 1500)
      return true
    }
    if (r === 'stuck') {
      await blocker(page, `${label}: could not reach waypoint ${JSON.stringify(points[i])}`)
      return false
    }
  }
  if (door) {
    // Nudge into the door if the last step stopped on its edge.
    for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown']) {
      const before = await playerPos(page)
      await hold(page, [k], 500)
      await pause(page, 1300)
      const after = await playerPos(page)
      if (before && after && Math.hypot(after[0] - before[0], after[1] - before[1]) > 260) return true
    }
    await blocker(page, `${label}: walked to the door but did not go through`)
    return false
  }
  return true
}

/** Waits for the "E · Use …" prompt and presses E. */
async function use(page: Page, label: RegExp): Promise<boolean> {
  const prompt = page.getByTestId('interact-prompt')
  const ok = await prompt.filter({ hasText: label }).waitFor({ timeout: 4000 }).then(() => true, () => false)
  if (!ok) {
    await blocker(page, `No "${label.source}" prompt where the station should be`)
    return false
  }
  await pause(page, 800)
  await page.keyboard.press('e')
  await pause(page, 1200)
  return true
}

/** Presses the primary button; a disabled one is a blocker (never waits on it). */
async function next(page: Page): Promise<boolean> {
  await nova(page)
  const b = page.getByTestId('next-button').first()
  await b.hover()
  await pause(page, 600)
  if (!(await b.isEnabled().catch(() => false))) {
    const label = (await b.innerText().catch(() => 'Next')).trim()
    const why = await page.locator('#next-hint').innerText().catch(() => '')
    await blocker(page, `The "${label}" button is disabled${why ? `: ${why}` : ''}`)
    return false
  }
  await b.click()
  await pause(page, 1200)
  await nova(page)
  return true
}

/** Reads an event for ~2 s and picks the first workable option. */
async function handleEvent(page: Page) {
  const title = await page.getByTestId('event-popup').getAttribute('data-event')
  await caption(page, `An event needs a decision (${title}): reading it`)
  await pause(page, 2200)
  const choice = page.locator('[data-testid^="choose-"]:not([disabled])').first()
  if (!(await choice.isVisible().catch(() => false))) {
    await blocker(page, `Event ${title}: no option can be chosen`)
    return
  }
  await caption(page, 'Choosing the most workable option')
  await choice.hover()
  await pause(page, 800)
  await choice.click()
  await page.getByTestId('result-toast').waitFor({ timeout: 20_000 }).catch(() => {})
  await pause(page, 2000)
}

// ---- the walkthrough -------------------------------------------------------------------------------

test('watchable walkthrough of the whole game', async ({ page }) => {
  test.setTimeout(15 * 60_000)
  page.on('pageerror', (e) => ugly.push(`- Page error: ${String(e).slice(0, 200)}`))

  // Main menu ------------------------------------------------------------------------------------
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await caption(page, 'Main menu')
  await expect(page.getByTestId('main-menu')).toBeVisible()
  await pause(page, 1500)
  for (const id of ['menu-settings', 'menu-about', 'menu-sandbox', 'start-mission-button']) {
    await page.getByTestId(id).hover().catch(() => {})
    await pause(page, 700)
  }
  await caption(page, 'Pressing PLAY GAME')
  await page.getByTestId('start-mission-button').click()
  if (await visible(page, 'confirm-new-game', 1500)) await page.getByTestId('confirm-new-game').click()
  if (!(await visible(page, 'hq-world', 15_000))) await blocker(page, 'The HQ did not open after PLAY GAME')
  await page.getByTestId('loading-screen').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
  await pause(page, 1500)

  if (process.env.WALK_DEBUG) {
    const fps = await page.evaluate(
      () =>
        new Promise<number>((r) => {
          let n = 0
          const t0 = performance.now()
          const f = () => (++n, performance.now() - t0 < 1000 ? requestAnimationFrame(f) : r(n))
          requestAnimationFrame(f)
        }),
    )
    console.log(`   fps ${fps}`)
  }
  // HQ tutorial ----------------------------------------------------------------------------------
  await caption(page, 'NOVA introduces itself')
  await nova(page)

  // Mission Planning -------------------------------------------------------------------------------
  await caption(page, 'Walking to the Mission Planning door…')
  if (await route(page, 'Lobby → Mission Planning', [[560, 440], [476, 410]], true)) {
    await nova(page)
    await caption(page, 'Walking to the holo star map…')
    await route(page, 'Mission Planning → star map', [[-412, 327]])
    if (await use(page, /Holo Star Map/i)) {
      await caption(page, 'Picking the Moon')
      await page.getByTestId('destination-card-moon').hover()
      await pause(page)
      await page.getByTestId('destination-card-moon').click()
      await next(page)
      await caption(page, 'Choosing the scenario and Engineer difficulty')
      const engineer = page.getByRole('radio', { name: /engineer/i })
      if (await engineer.isVisible().catch(() => false)) await engineer.click()
      else await blocker(page, 'Engineer difficulty option not found')
      await pause(page)
      await page.locator('[data-testid^="scenario-card-"]').first().click()
      await caption(page, 'Using the demo seed, so every run plays the same mission')
      await page.getByTestId('seed-change').click()
      await page.getByTestId('seed-demo').click()
      await page.getByTestId('seed-set').click()
      await pause(page)
      await next(page)
    }
    await caption(page, 'Back to the lobby')
    await route(page, 'Mission Planning → lobby', [[-600, 350], [-651, 340]], true)
  }

  // Personnel ---------------------------------------------------------------------------------------
  await nova(page)
  await caption(page, 'Walking to the Personnel door…')
  if (await route(page, 'Lobby → Personnel', [[580, 430], [612, 385], [599, 352]], true)) {
    await nova(page)
    await caption(page, 'Walking to the desk terminal…')
    await route(page, 'Personnel → desk', [[100, -76], [40, -66]])
    if (await use(page, /Desk Terminal/i)) {
      await caption(page, 'Taking the Power & Life Support seat')
      await page.getByTestId('role-card-power_life').click()
      await next(page)
      await caption(page, 'Recruiting a balanced crew with "Suggested team"')
      await page.getByTestId('suggest-team-button').click()
      await pause(page, 1500)
      const card = page.locator('[data-testid^="crew-card-"]').first()
      await caption(page, 'Reading one crew member’s file')
      await card.click()
      await pause(page, 3000)
      if (!(await visible(page, 'crew-detail'))) await blocker(page, 'Crew file did not open')
      await caption(page, 'Confirming the crew')
      await next(page)
    }
    await caption(page, 'Back to the lobby')
    await route(page, 'Personnel → lobby', [[60, -100], [46, -128]], true)
  }

  // Briefing ------------------------------------------------------------------------------------------
  await nova(page)
  await caption(page, 'Walking to the Briefing door…')
  if (await route(page, 'Lobby → Briefing', [[700, 380], [788, 350]], true)) {
    await nova(page)
    await caption(page, 'Walking to the meeting table…')
    await route(page, 'Briefing → table', [[1260, -95], [1333, -113]])
    if (await use(page, /Meeting Table/i)) {
      await page.getByTestId('planning-board').waitFor({ timeout: 10_000 }).catch(() => {})
      await nova(page)
      await caption(page, 'The planning board: checking the margins')
      await pause(page, 2500)
      if (await visible(page, 'hint-button')) {
        await caption(page, 'Over mass and budget: asking for suggested fixes')
        await page.getByTestId('hint-button').click()
        await pause(page, 3000)
      }
      // With the demo seed, dropping one fuel cell (my own seat's part) fits mass and budget.
      const cell = page.getByRole('button', { name: /^Remove Regenerative Fuel Cell/i })
      if (await cell.isVisible().catch(() => false)) {
        await caption(page, 'Removing one heavy fuel cell from my seat to fit mass and budget')
        await cell.scrollIntoViewIfNeeded()
        await cell.hover()
        await pause(page)
        await cell.click()
        await pause(page, 2000)
        await nova(page)
      } else await blocker(page, 'No "Remove Regenerative Fuel Cell" button in my parts list')
      const red = await page.locator('[data-testid^="gauge-"][data-status="fail"]').count()
      if (red > 0) await note(page, `Planning board still has ${red} failing margin(s) after the fixes`)
      await caption(page, 'Opening a negotiation with a teammate')
      const mate = page.locator('[data-testid^="teammate-card-"]').first()
      if (await mate.isVisible().catch(() => false)) {
        await mate.click()
        await pause(page, 1500)
        const ask = page.getByTestId('trade-ask')
        const opts = await ask.locator('option').count().catch(() => 0)
        if (opts > 1) {
          await ask.selectOption({ index: 1 })
          await pause(page)
          await caption(page, 'Proposing a trade')
          await page.getByTestId('propose-trade').click()
          await page.getByTestId('trade-response').waitFor({ timeout: 5000 }).catch(() => {})
          await pause(page, 3000)
        } else await blocker(page, 'Negotiation had nothing to ask for')
        await page.keyboard.press('Escape')
        await pause(page)
      } else await blocker(page, 'No teammate portrait to negotiate with')
      await nova(page)
      await caption(page, 'Plan done: on to the Launch Check')
      await next(page)
    }
    await caption(page, 'Back to the lobby')
    await route(page, 'Briefing → lobby', [[1190, -85], [1164, -90]], true)
  }

  // Launch Control --------------------------------------------------------------------------------------
  await nova(page)
  await caption(page, 'Walking to Launch Control…')
  if (await route(page, 'Lobby → Launch Control', [[860, 430], [900, 405]], true)) {
    await nova(page)
    await caption(page, 'Walking to the main console…')
    await route(page, 'Launch Control → console', [[1526, 518], [1766, 438]])
    if (await use(page, /Main Console/i)) {
      await nova(page)
      await caption(page, 'Go / no-go poll: every seat calls it')
      await page.getByTestId('final-call').waitFor({ timeout: 10_000 }).catch(() => {})
      await pause(page, 5000)
      const call = await page.getByTestId('final-call').getAttribute('data-call').catch(() => null)
      if (call === 'NO-GO') await blocker(page, 'Launch check is NO-GO: cannot launch')
      await caption(page, `Final call: ${call ?? '?'}. Launching!`)
      if (!(await next(page))) await caption(page, 'Cannot launch: skipping the mission part')
      if (await visible(page, 'confirm-launch', 2000)) {
        await caption(page, 'Accepting the known risks')
        await pause(page, 2000)
        await page.getByTestId('confirm-launch').click()
      }
      await caption(page, 'Countdown, lift-off and the trip out')
      await page.getByTestId('launch-sequence').waitFor({ state: 'detached', timeout: 60_000 }).catch(() => {})
    }
  }

  // Habitat -------------------------------------------------------------------------------------------------
  if (!(await visible(page, 'habitat-world', 20_000))) {
    await blocker(page, 'The habitat did not open after the launch')
  } else {
    await page.getByTestId('loading-screen').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
    await caption(page, 'Arrived. NOVA explains the HUD')
    await pause(page, 1500)
    await nova(page)

    // No saved position in the habitat: walk by feel and watch the prompt.
    const seen = new Set<string>()
    const steps: Array<{ keys: string[]; label: string }> = [
      { keys: ['ArrowLeft', 'ArrowUp'], label: 'Walking over to the comms station…' },
      { keys: ['ArrowLeft'], label: 'Walking along the consoles…' },
      { keys: ['ArrowLeft', 'ArrowDown'], label: 'Heading to the power panel…' },
    ]
    for (const s of steps) {
      await caption(page, s.label)
      for (let i = 0; i < 8; i++) {
        await hold(page, s.keys, 450)
        await pause(page, 300)
        const text = (await page.getByTestId('interact-prompt').innerText().catch(() => '')).trim()
        if (!text || seen.has(text)) continue
        seen.add(text)
        await caption(page, text.replace(/^E · /, 'Pressing E: '))
        await pause(page, 600)
        await page.keyboard.press('e')
        await pause(page, 3500)
        await page.keyboard.press('Escape')
        await pause(page, 1000)
      }
    }
    if (![...seen].some((t) => /Talk to/i.test(t))) await blocker(page, 'Never reached a crew member to talk to')
    if ([...seen].filter((t) => /Use /i.test(t)).length < 2) await blocker(page, `Reached fewer than two stations (${[...seen].join(', ')})`)

    await caption(page, 'Pressing NEXT TURN a few times')
    for (let i = 0; i < 3; i++) {
      if (await visible(page, 'event-popup')) await handleEvent(page)
      await nova(page)
      const btn = page.getByTestId('next-turn')
      if (await btn.isEnabled().catch(() => false)) {
        await btn.hover()
        await pause(page, 500)
        await btn.click()
      }
      await pause(page, 2000)
    }

    await caption(page, 'FAST-FORWARD to the end of the mission')
    for (let round = 0; round < 60; round++) {
      if (await visible(page, 'mission-end')) break
      if (!(await visible(page, 'habitat-world'))) break
      if (await visible(page, 'event-popup')) {
        await handleEvent(page)
        continue
      }
      await nova(page)
      const ff = page.getByTestId('fast-forward')
      if (await ff.isEnabled().catch(() => false)) {
        await caption(page, 'FAST-FORWARD to the end of the mission')
        await ff.click()
      }
      await page
        .waitForFunction(
          () =>
            document.querySelector('[data-testid="event-popup"],[data-testid="mission-end"],[data-testid="nova-lesson"]') ||
            !document.querySelector('[data-testid="stop-ff"]'),
          null,
          { timeout: 120_000 },
        )
        .catch(() => {})
      await pause(page, 1200)
    }
    await caption(page, 'Mission over')
    await page.getByTestId('mission-end').waitFor({ timeout: 30_000 }).catch(() => blocker(page, 'No mission end card'))
  }

  // Debrief ------------------------------------------------------------------------------------------------------
  await caption(page, 'Back to Earth: the debrief')
  if (!(await visible(page, 'debrief', 30_000))) {
    await blocker(page, 'The debrief popup did not open')
  } else {
    await nova(page)
    await pause(page, 2500)
    await caption(page, 'Reading the score and what happened')
    const scroller = page.locator('[data-testid="world-popup"] .overflow-y-auto').first()
    await scroller.hover()
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 220)
      await pause(page, 1300)
    }
    const items = page.locator('[data-testid="cause-list"] li')
    const n = Math.min(3, await items.count())
    for (let i = 0; i < n; i++) {
      await items.nth(i).scrollIntoViewIfNeeded()
      await items.nth(i).hover()
      await pause(page, 1800)
    }
    const tips = page.locator('[data-testid="score-breakdown"] button[aria-label]')
    for (let i = 0; i < Math.min(2, await tips.count()); i++) {
      await tips.nth(i).hover()
      await pause(page, 1800)
    }
    await caption(page, 'The end: try REDESIGN & RETRY to fly again')
    await pause(page, 20_000)
  }

  // Video + notes -------------------------------------------------------------------------------------------------
  fs.mkdirSync(VIDEO_DIR, { recursive: true })
  const video = page.video()
  await page.close()
  const out = path.join(VIDEO_DIR, `walkthrough-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`)
  await video?.saveAs(out)
  console.log(`🎬 Video: ${out}`)

  fs.mkdirSync('docs', { recursive: true })
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  fs.appendFileSync(
    NOTES,
    `\n## Walkthrough ${stamp}\n\nVideo: \`${out.replace(/\\/g, '/')}\`\n\n### Blockers\n\n${blockers.join('\n') || '- None'}\n\n### Ugly moments\n\n${ugly.join('\n') || '- None noticed automatically'}\n`,
  )
})
