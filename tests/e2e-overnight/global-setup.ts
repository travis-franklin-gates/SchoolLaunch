import { chromium, type FullConfig } from '@playwright/test'
import { existsSync, appendFileSync } from 'node:fs'
import { loadEnv } from './_guard'

// Auth once (test-columbia) -> storageState reused by every spec. Also asserts the
// Phase -1 snapshot exists; without a restorable snapshot we must not proceed (safety).
export default async function globalSetup(config: FullConfig) {
  loadEnv()
  const log = (m: string) => { try { appendFileSync('tests/e2e-overnight/run.log', `${new Date().toISOString()} | ${m}\n`) } catch {} }

  if (!existsSync('tests/e2e-overnight/_snapshot/restore.sql')) {
    throw new Error('SAFETY ABORT: no restore snapshot found — refusing to run browser matrix.')
  }
  const base = config.projects[0].use.baseURL as string
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill('test-columbia@schoollaunch.test')
  await page.locator('input[type="password"]').fill('excellent')
  await Promise.all([
    page.waitForURL(/\/(dashboard|select-school|onboarding|portfolio)/, { timeout: 30_000 }),
    page.locator('button[type="submit"]').first().click(),
  ])
  if (page.url().includes('/select-school')) {
    await page.locator('button, a').filter({ hasText: /Columbia/i }).first().click().catch(() => {})
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 }).catch(() => {})
  }
  await page.context().storageState({ path: 'tests/e2e-overnight/_artifacts/storageState.json' })
  await browser.close()
  log('globalSetup: authenticated test-columbia, storageState saved')
}
