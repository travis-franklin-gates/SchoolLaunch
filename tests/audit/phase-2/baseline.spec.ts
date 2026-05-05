import { test } from '@playwright/test'
import * as path from 'path'
import { test as fxTest, ACCOUNTS, loginAs } from '../../session4/e2e/fixtures'

/**
 * Phase 2 — BASELINE screenshot capture.
 *
 * Captures full-page screenshots of every surface this phase will modify,
 * BEFORE any code changes. Pair with `spec.ts` post-implementation to do a
 * visual diff.
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 \
 *     npx playwright test tests/audit/phase-2/baseline.spec.ts
 */

const SURFACES = [
  { slug: 'overview', path: '/dashboard' },
  { slug: 'revenue', path: '/dashboard/revenue' },
  { slug: 'operations', path: '/dashboard/operations' },
  { slug: 'cashflow', path: '/dashboard/cashflow' },
  { slug: 'staffing', path: '/dashboard/staffing' },
  { slug: 'scenarios', path: '/dashboard/scenarios' },
  { slug: 'multiyear', path: '/dashboard/multiyear' },
  { slug: 'scorecard', path: '/dashboard/scorecard' },
]

const BASELINE_DIR = path.join(__dirname, 'baseline')

fxTest.describe('Phase 2 baseline capture', () => {
  fxTest('captures all 8 surfaces', async ({ page }) => {
    test.setTimeout(180_000)
    await loginAs(page, ACCOUNTS.spokaneArts)

    for (const surface of SURFACES) {
      await page.goto(surface.path)
      await page.waitForLoadState('networkidle').catch(() => undefined)
      await page.waitForTimeout(600)
      await page.screenshot({
        path: path.join(BASELINE_DIR, `${surface.slug}.png`),
        fullPage: true,
      })
    }
  })
})
