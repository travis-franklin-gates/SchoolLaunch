import { test as fxTest, expect } from '../../session4/e2e/fixtures'
import * as path from 'path'

/**
 * Phase 4 — POST-IMPLEMENTATION verification.
 *
 * Captures rendered screenshots of /login and /signup and asserts the
 * Phase 4 visual contract: split-pane navy brand panel renders, FormField
 * labels and the live password checklist render on signup.
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 \
 *     npx playwright test tests/audit/phase-4/phase-4.spec.ts
 *
 * NOT covered by this spec (require fixture mutation):
 * - Onboarding welcome screen, steps 1-5, completion screen.
 * - Invite flow acceptance (requires generating a fresh invitation).
 * - Password reset flow (requires real email + OTP).
 *
 * For those flows, run a manual fresh-signup walkthrough end-to-end.
 */

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

fxTest.describe('Phase 4 verification', () => {
  fxTest('login page renders split-pane shell', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    // Brand panel (md+): dark navy aside with SchoolLaunch logo + tagline.
    const brandPanel = page.locator('aside').first()
    await expect(brandPanel).toBeVisible()
    await expect(brandPanel).toContainText('SchoolLaunch')
    await expect(brandPanel).toContainText('charter school founders')

    // Form heading.
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible()

    // FormField-rendered email + password inputs (no standalone <label>).
    await expect(page.locator('input[type=email]')).toBeVisible()
    await expect(page.locator('input[type=password]')).toBeVisible()

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'login.png'),
      fullPage: true,
    })
  })

  fxTest('signup live password checklist activates on input', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible()

    // Submit disabled before input.
    const submit = page.getByRole('button', { name: /Create Account/i })
    await expect(submit).toBeDisabled()

    const passwordInput = page.getByLabel('Password', { exact: true })
    const confirmInput = page.getByLabel('Confirm Password')

    // Type a short password — neither rule satisfied.
    await passwordInput.fill('a9')
    await expect(page.getByText('At least 8 characters')).toBeVisible()
    await expect(page.getByText('Contains a number or symbol')).toBeVisible()

    // Type a valid password but a non-matching confirm.
    await passwordInput.fill('strongpass1')
    await confirmInput.fill('different')
    await expect(page.getByText('Passwords do not match.')).toBeVisible()

    // Match confirm + name → submit enabled (modulo email).
    await confirmInput.fill('strongpass1')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Full Name').fill('Test User')
    await expect(submit).not.toBeDisabled()

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'signup.png'),
      fullPage: true,
    })
  })
})
