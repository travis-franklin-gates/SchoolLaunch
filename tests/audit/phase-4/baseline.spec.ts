import { test } from '@playwright/test'
import * as path from 'path'
import { test as fxTest } from '../../session4/e2e/fixtures'

/**
 * Phase 4 — BASELINE screenshot capture for AUTH surfaces.
 *
 * Captures /login and /signup before Phase 4 polish (split-pane auth layout,
 * live password checklist). Onboarding mid-flow baselines (welcome, step 1-5,
 * complete) are NOT captured here because those screens require a partially
 * onboarded test school — too costly to fixture for one-time diff.
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 \
 *     npx playwright test tests/audit/phase-4/baseline.spec.ts
 */

const PUBLIC_SURFACES = [
  { slug: 'login', path: '/login' },
  { slug: 'signup', path: '/signup' },
]

const BASELINE_DIR = path.join(__dirname, 'baseline')

fxTest.describe('Phase 4 baseline capture', () => {
  fxTest('captures public auth surfaces', async ({ page }) => {
    test.setTimeout(120_000)
    for (const surface of PUBLIC_SURFACES) {
      await page.goto(surface.path)
      await page.waitForLoadState('networkidle').catch(() => undefined)
      await page.waitForTimeout(500)
      await page.screenshot({
        path: path.join(BASELINE_DIR, `${surface.slug}.png`),
        fullPage: true,
      })
    }
  })
})
