import { test } from '@playwright/test'
import * as path from 'path'
import { test as fxTest, ACCOUNTS, loginAs } from '../../session4/e2e/fixtures'

/**
 * Phase 3 — BASELINE screenshot capture.
 *
 * Captures full-page screenshots of every dashboard tab BEFORE any Phase 3
 * code changes (PageHeader rollout, Callout migrations, sticky action bars).
 * Pair with the post-implementation `spec.ts` for visual diff.
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 \
 *     npx playwright test tests/audit/phase-3/baseline.spec.ts
 */

const SURFACES = [
  { slug: 'overview', path: '/dashboard' },
  { slug: 'revenue', path: '/dashboard/revenue' },
  { slug: 'staffing', path: '/dashboard/staffing' },
  { slug: 'operations', path: '/dashboard/operations' },
  { slug: 'cashflow', path: '/dashboard/cashflow' },
  { slug: 'multiyear', path: '/dashboard/multiyear' },
  { slug: 'scenarios', path: '/dashboard/scenarios' },
  { slug: 'ask', path: '/dashboard/ask' },
  { slug: 'advisory', path: '/dashboard/advisory' },
  { slug: 'alignment', path: '/dashboard/alignment' },
  { slug: 'scorecard', path: '/dashboard/scorecard' },
  { slug: 'settings', path: '/dashboard/settings' },
]

const BASELINE_DIR = path.join(__dirname, 'baseline')

fxTest.describe('Phase 3 baseline capture', () => {
  fxTest('captures all 12 dashboard tabs', async ({ page }) => {
    test.setTimeout(240_000)
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
