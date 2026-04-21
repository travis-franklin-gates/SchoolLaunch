import { test, expect, ACCOUNTS, loginAs } from './fixtures'

/**
 * E2E — AUDIT 5.5 Anthropic retry / 503 error surface.
 *
 * Per user guidance, true end-to-end retry timing of the Anthropic SDK cannot
 * be reliably tested via Playwright route interception because the SDK calls
 * are server-side (Next.js route handler → api.anthropic.com), not browser-
 * initiated. `page.route('**\/api.anthropic.com/**')` only intercepts requests
 * the browser makes; it does not see requests made by the Node.js process.
 *
 * Unit-test coverage for the retry math (429, 529, retry-after honoring,
 * exhaustion) lives in tests/session4/anthropic-retry.spec.ts — 9/9 green at
 * commit c500626.
 *
 * What we CAN test E2E: the UI's handling of the 503 that the route handlers
 * surface when retries exhaust (AIUnavailableError → 503 with
 * "AI temporarily unavailable — try again in a moment."). We mock the browser-
 * visible /api/chat and /api/alignment endpoints to return the same 503 shape
 * and assert the UI:
 *   - does not render a raw stack trace or unhandled error
 *   - displays a user-friendly message
 *
 * The retry-happy-path test is explicitly SKIPPED — see the skip message for
 * the rationale.
 */

test.describe.configure({ mode: 'serial' })

test.describe('Suite 13 — Anthropic retry / 503 error surface', () => {
  test.skip(
    'Retry happy path (429 x2 → success) — covered by unit tests',
    async () => {
      // Intentional skip. Reason: the Anthropic SDK call is server-side inside
      // /api/chat, /api/alignment, /api/advisory, and /api/export/narrative.
      // Playwright's page.route() cannot intercept it. Covered by
      // tests/session4/anthropic-retry.spec.ts (9/9 tests of withRetry() +
      // AIUnavailableError + retry-after honoring).
    }
  )

  test('/api/chat 503 surfaces a typed error in the Ask SchoolLaunch UI (no raw stack trace)', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)

    // Mock /api/chat to always return the retry-exhausted 503 payload.
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI temporarily unavailable — try again in a moment.' }),
      })
    })

    await page.goto('/dashboard/ask')
    // Input + submit per ask/page.tsx:221
    const input = page.getByPlaceholder(/ask about your budget/i)
    await expect(input).toBeVisible({ timeout: 15_000 })
    await input.fill('What are my Year 1 revenue drivers?')
    await input.press('Enter')

    // UI should surface a friendly system message (red error bubble per ask/page.tsx:200).
    // The chat page renders a 'system' role message when res.ok is false.
    // The generic fallback is "Sorry, something went wrong. Please try again."
    await expect(
      page.getByText(/sorry, something went wrong|connection error|temporarily unavailable/i)
    ).toBeVisible({ timeout: 20_000 })

    // Negative assertions: no raw stack trace / unhandled error spew in the DOM.
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/at new Error|at async/i)
    expect(bodyText).not.toMatch(/TypeError:|SyntaxError:|ReferenceError:/)
    // Confirm the input is re-enabled (the app recovered from streaming=false).
    await expect(input).toBeEnabled({ timeout: 10_000 })
  })

  test('/api/alignment 503 surfaces a typed error in the Alignment UI (no raw stack)', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)

    await page.route('**/api/alignment', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI temporarily unavailable — try again in a moment.' }),
      })
    })

    await page.goto('/dashboard/alignment')
    await page.waitForSelector('input[type="file"]', { timeout: 15_000, state: 'attached' })

    // Upload the clean narrative just to trigger the flow.
    const path = await import('node:path')
    const filePath = path.join(__dirname, 'fixtures', 'clean_narrative.txt')
    await page.locator('input[type="file"]').setInputFiles(filePath)

    const analyzeBtn = page.getByRole('button', { name: /^analyze alignment$/i })
    await expect(analyzeBtn).toBeEnabled({ timeout: 10_000 })
    await analyzeBtn.click()

    // The alignment page renders the error string via handleAnalyze's catch (page.tsx:219)
    // into the red top banner (page.tsx:258). It uses err.message directly, which for
    // a 503 JSON payload becomes the "AI temporarily unavailable…" string from errData.error.
    await expect(
      page.getByText(/temporarily unavailable|analysis failed/i)
    ).toBeVisible({ timeout: 20_000 })

    // No stack trace leakage.
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/at new Error|at async/i)
    expect(bodyText).not.toMatch(/TypeError:|SyntaxError:|ReferenceError:/)
  })
})
