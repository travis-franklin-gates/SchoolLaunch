import { test, expect } from '@playwright/test'
import type { ConsoleMessage } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Phase 1 — Tokens & primitives visual regression spec.
 *
 * Loads /dev/components, captures a full-page screenshot, asserts every
 * primitive renders, and asserts the --status-* palette tokens resolve to
 * the expected RGB values via getComputedStyle.
 *
 * REQUIREMENTS to run this spec:
 *   1. Dev server started with NEXT_PUBLIC_DEV_TOOLS=1, e.g.:
 *        NEXT_PUBLIC_DEV_TOOLS=1 npm run dev
 *      (Or set it in .env.local — Next inlines NEXT_PUBLIC_* at startup.)
 *   2. PLAYWRIGHT_BASE_URL set to the dev server origin (defaults to
 *      http://localhost:3000 via playwright.config.ts).
 *
 * The page is gated behind NEXT_PUBLIC_DEV_TOOLS — without the flag, the
 * route returns 404 by design. The first test below skips with a helpful
 * message rather than failing if the route is unreachable.
 */

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

function ensureScreenshotDir(): void {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const EXPECTED_RGB = {
  meets: 'rgb(236, 253, 245)',       // --teal-50  #ECFDF5
  approaching: 'rgb(255, 251, 235)', // --amber-50 #FFFBEB
  fails: 'rgb(255, 241, 242)',       // --rose-50  #FFF1F2
} as const

test.describe('Phase 1 — /dev/components visual regression', () => {
  test('renders every primitive without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('Failed to load resource') && text.includes('favicon')) return
      if (text.includes('Download the React DevTools')) return
      errors.push(text)
    })
    page.on('pageerror', (err) => {
      errors.push(`pageerror: ${err.message}`)
    })

    const response = await page.goto('/dev/components')
    if (!response || response.status() === 404) {
      test.skip(true, 'Route 404 — dev server must be started with NEXT_PUBLIC_DEV_TOOLS=1.')
    }

    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(600)

    ensureScreenshotDir()
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dev-components.png'), fullPage: true })

    // Every section heading is present.
    for (const id of [
      'status-health',
      'callouts',
      'page-header-demo',
      'form-fields',
      'tabs',
      'data-table',
      'skeleton',
      'dialog-toast',
    ]) {
      await expect(page.locator(`[data-testid="section-${id}"]`)).toBeVisible()
    }

    // Primitive-level data-testids.
    expect(await page.locator('[data-testid="page-header"]').count()).toBeGreaterThan(0)
    expect(await page.locator('[data-testid="health-tile"]').count()).toBeGreaterThanOrEqual(4)

    // StatusBadge: each status value rendered at least once.
    for (const status of ['meets', 'approaching', 'fails', 'na']) {
      expect(await page.locator(`[data-status="${status}"]`).count()).toBeGreaterThan(0)
    }

    // DataTable rendered with the existing .sl-table CSS hook.
    await expect(page.locator('section#data-table table.sl-table')).toBeVisible()

    // Tabs rendered as a tablist (Radix sets role automatically).
    expect(await page.locator('[role="tablist"]').count()).toBeGreaterThanOrEqual(2)

    expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('--status-* palette resolves to expected background colors', async ({ page }) => {
    const response = await page.goto('/dev/components')
    if (!response || response.status() === 404) {
      test.skip(true, 'Route 404 — dev server must be started with NEXT_PUBLIC_DEV_TOOLS=1.')
    }

    await page.waitForLoadState('networkidle').catch(() => undefined)

    for (const status of ['meets', 'approaching', 'fails'] as const) {
      const el = page.locator(`[data-status="${status}"]`).first()
      await expect(el).toBeVisible()
      const bg = await el.evaluate((node) => getComputedStyle(node).backgroundColor)
      expect(bg, `Expected data-status="${status}" background to resolve to ${EXPECTED_RGB[status]}, got ${bg}`).toBe(EXPECTED_RGB[status])
    }
  })
})
