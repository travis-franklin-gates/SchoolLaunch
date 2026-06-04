import { defineConfig, devices } from '@playwright/test'

// Overnight full-lifecycle config. Serial + single worker (we mutate ONE shared account);
// prod build served via webServer for stability over a long unattended run.
const PORT = process.env.E2E_PORT || '3030'
const BASE = `http://localhost:${PORT}`

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 2,
  timeout: 5 * 60_000,
  globalTimeout: 3 * 60 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'tests/e2e-overnight/_artifacts/html', open: 'never' }]],
  outputDir: 'tests/e2e-overnight/_artifacts/test-results',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: BASE,
    storageState: 'tests/e2e-overnight/_artifacts/storageState.json',
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
