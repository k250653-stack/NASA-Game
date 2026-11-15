import { defineConfig, devices } from '@playwright/test'

/** Port the e2e dev server listens on. An already running `pnpm dev` on it is reused locally. */
const PORT = 5173

/** WATCH=1 (pnpm e2e:watch): visible browser, slowed down, one test at a time, 1280x720 only. */
const WATCH = process.env.WATCH === '1'

export default defineConfig({
  testDir: '.',
  // The watchable walkthrough is run on its own (pnpm walkthrough).
  testIgnore: ['walkthrough.spec.ts'],
  outputDir: './test-results',
  fullyParallel: true,
  // The dev server is shared; more workers make every page slower than it really is.
  workers: WATCH ? 1 : 2,
  forbidOnly: !!process.env.CI,
  // One retry so a trace is recorded on the first retry; a flaky pass still shows as flaky.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: !WATCH,
    launchOptions: WATCH ? { slowMo: 400 } : {},
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: '1280x720',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    // Watching both sizes doubles the wait; the headless run covers 1920x1080.
    ...(WATCH
      ? []
      : [
          {
            name: '1920x1080',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
          },
        ]),
  ],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
