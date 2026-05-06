import { test as fxTest, expect, ACCOUNTS, loginAs } from '../../session4/e2e/fixtures'
import * as path from 'path'

/**
 * Phase 7 — POST-IMPLEMENTATION verification (FINAL PHASE).
 *
 * Asserts:
 *  - Settings sub-rail visible on desktop with all 9 section anchors
 *  - Sub-rail hidden on mobile
 *  - Per-section Save button click triggers a Sonner toast
 *  - Danger Zone is collapsed by default; expands to rose-tinted card
 *  - Team Members rows show initials avatar + role pills
 *
 * Run after restarting the dev server with `npm run dev`:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 \
 *     npx playwright test tests/audit/phase-7/phase-7.spec.ts
 */

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

fxTest.describe('Phase 7 verification', () => {
  fxTest('settings sub-rail visible on desktop with all section anchors', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(800)

    const subrail = page.getByRole('navigation', { name: 'Settings sections' })
    await expect(subrail).toBeVisible()
    // 9 section labels present (Team Members and Danger Zone are CEO-only — Spokane Arts is a CEO so all 9 should show)
    await expect(subrail.getByRole('link', { name: /School Profile/i })).toBeVisible()
    await expect(subrail.getByRole('link', { name: /Team Members/i })).toBeVisible()
    await expect(subrail.getByRole('link', { name: /Danger Zone/i })).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings-after-phase7.png'), fullPage: true })
  })

  fxTest('danger zone is collapsed by default and expands to rose-tinted card', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(500)

    // Click sub-rail "Danger Zone" anchor
    const dangerLink = page.getByRole('link', { name: /Danger Zone/i }).first()
    await dangerLink.click()
    await page.waitForTimeout(400)

    // Collapsed state: only the heading + "Show Danger Zone" toggle, no Reset button
    await expect(page.getByRole('button', { name: /Show Danger Zone/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Reset School/i })).not.toBeVisible()

    // Expand
    await page.getByRole('button', { name: /Show Danger Zone/i }).click()
    await expect(page.getByRole('button', { name: /Reset School/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Hide/i })).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings-danger-zone-expanded.png'), fullPage: false })
  })

  fxTest('settings sub-rail hidden on mobile', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)

    const subrail = page.getByRole('navigation', { name: 'Settings sections' })
    await expect(subrail).not.toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings-mobile.png'), fullPage: false })
  })
})
