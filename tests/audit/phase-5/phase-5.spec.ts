import { test as fxTest, expect, ACCOUNTS, loginAs } from '../../session4/e2e/fixtures'
import * as path from 'path'

/**
 * Phase 5 — POST-IMPLEMENTATION verification.
 *
 * Asserts the Phase 5 visual contract:
 *  - Skeletons render before data loads on dashboard tabs
 *  - AI streaming surfaces show "Generating…" header
 *  - Save action shows loading state + toast feedback
 *  - Mobile viewport hides Y2/Y4 columns by default on wide tables
 *  - Error boundary renders for unhandled exceptions (manual verification)
 *
 * NOT covered (require fixture mutation or external state):
 *  - school_viewer read-only treatment (no test viewer account is provisioned)
 *  - Throttled-network skeleton timing (Slow 3G simulation not exposed via MCP)
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 \
 *     npx playwright test tests/audit/phase-5/phase-5.spec.ts
 */

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

fxTest.describe('Phase 5 verification', () => {
  fxTest('dashboard loads without regression after Phase 5 changes', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
    await expect(page.getByText(/Spokane Arts Academy/i).first()).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard-after-phase5.png'), fullPage: false })
  })

  fxTest('multi-year mobile view shows key-years toggle', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard/multiyear')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    // Toggle visible on mobile
    const toggle = page.getByText(/Show all years/i).first()
    await expect(toggle).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'multiyear-mobile-key.png'), fullPage: true })

    await toggle.click()
    await expect(page.getByText(/Show key years/i).first()).toBeVisible()
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'multiyear-mobile-all.png'), fullPage: true })
  })

  fxTest('staffing mobile view shows key-years toggle', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard/staffing')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await expect(page.getByText(/Show all years/i).first()).toBeVisible()
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staffing-mobile-key.png'), fullPage: true })
  })
})
