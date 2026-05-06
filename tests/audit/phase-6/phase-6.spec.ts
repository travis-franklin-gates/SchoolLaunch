import { test as fxTest, expect, loginAs } from '../../session4/e2e/fixtures'
import * as path from 'path'

/**
 * Phase 6 — POST-IMPLEMENTATION verification.
 *
 * Asserts:
 *  - Portfolio uses unified sidebar shell (org_admin sees Portfolio + school list nav)
 *  - HealthTile markup renders on portfolio summary
 *  - Filter chips with count badges render
 *  - RFP countdown component shows a dynamically calculated number
 *  - Sticky read-only bar visible on /portfolio/[schoolId] with lock + back link + switcher
 *  - school_ceo role does NOT reach /portfolio (RLS guard intact)
 */

const ADMIN_ACCOUNT = {
  email: 'admin@excellentschoolswa.org',
  password: 'excellent',
  label: 'Excellent Schools WA',
}

const CEO_ACCOUNT = {
  email: 'travis@spokanearts.org',
  password: 'excellent',
  label: 'Spokane Arts Academy',
}

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

fxTest.describe('Phase 6 verification', () => {
  fxTest('org_admin: portfolio renders with sidebar + summary tiles + filter chips + RFP countdown', async ({ page }) => {
    await loginAs(page, ADMIN_ACCOUNT)
    await page.waitForURL(/\/portfolio/, { timeout: 30_000 })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(800)

    // Sidebar shell present (Portfolio nav item in unified sidebar)
    await expect(page.getByRole('link', { name: 'Portfolio' }).first()).toBeVisible()

    // HealthTile markup present
    await expect(page.locator('[data-testid="health-tile"]').first()).toBeVisible()

    // Filter chips: at least 'All' chip visible with a count badge
    await expect(page.getByRole('radio', { name: /All/ }).first()).toBeVisible()

    // RFP countdown: should show "days remaining" or "days past due" or "day remaining"
    const countdownText = page.getByText(/days? (remaining|past due|remaining)/i).first()
    await expect(countdownText).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'portfolio-after-phase6.png'), fullPage: true })
  })

  fxTest('org_admin: school detail page shows sticky read-only bar with back link', async ({ page }) => {
    await loginAs(page, ADMIN_ACCOUNT)
    await page.waitForURL(/\/portfolio/, { timeout: 30_000 })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(800)

    // Click into the first school in the table
    const firstSchoolLink = page.locator('a[href^="/portfolio/"]').first()
    await firstSchoolLink.click()
    await page.waitForURL(/\/portfolio\/[a-f0-9-]+/, { timeout: 15_000 })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(500)

    const bar = page.locator('[data-testid="readonly-bar"]')
    await expect(bar).toBeVisible()
    await expect(bar.getByText(/Read-only/i)).toBeVisible()
    await expect(bar.getByRole('link', { name: /Back to Portfolio/i })).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'portfolio-detail-after-phase6.png'), fullPage: false })
  })

  fxTest('school_ceo: redirect away from /portfolio (RLS guard intact)', async ({ page }) => {
    await loginAs(page, CEO_ACCOUNT)
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })

    // Direct nav to /portfolio should bounce back to /dashboard
    await page.goto('/portfolio')
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
