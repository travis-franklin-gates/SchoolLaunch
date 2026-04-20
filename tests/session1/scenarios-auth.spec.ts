import { test, expect, ACCOUNTS, loginAs, getCurrentSchoolId, getSupabaseService } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

/**
 * Suite 5 — Scenarios endpoint authentication (Session 3, Fix 6 / AUDIT 6.1).
 *
 * Verifies that /api/scenarios/seed and /api/scenarios/calculate enforce auth + school access
 * via the shared `authenticateRequest` helper.
 *
 * Scenarios:
 *   A) Unauthenticated POST → 401
 *   B) Authenticated user POSTing their own schoolId → NOT 401/403 (passes gate)
 *   C) Authenticated user POSTing a DIFFERENT school's schoolId → 403
 *   D) Missing schoolId → 400
 *
 * For C we use the Spokane Arts CEO session against Columbia Valley's schoolId.
 */

const ENDPOINTS = [
  { path: '/api/scenarios/seed' },
  { path: '/api/scenarios/calculate' },
] as const

async function getColumbiaSchoolId(): Promise<string> {
  const supabase = getSupabaseService()
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .ilike('name', '%Columbia Valley%')
    .limit(1)
  if (error || !data || data.length === 0) {
    throw new Error('Could not resolve Columbia Valley school id: ' + (error?.message ?? 'not found'))
  }
  return data[0].id as string
}

test.describe('Suite 5 — Scenarios endpoint authentication', () => {
  test('A) Unauthenticated requests are rejected 401', async ({ request }) => {
    for (const { path } of ENDPOINTS) {
      const res = await request.post(path, { data: { schoolId: 'some-id' } })
      expect(res.status(), `${path} unauthenticated should be 401`).toBe(401)
    }
  })

  test('D) Missing schoolId yields 400', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, ACCOUNTS.spokaneArts)
    const apiCtx: APIRequestContext = ctx.request
    for (const { path } of ENDPOINTS) {
      const res = await apiCtx.post(path, { data: {} })
      expect(res.status(), `${path} without schoolId should be 400`).toBe(400)
    }
    await ctx.close()
  })

  test('B/C) Own school allowed, cross-school forbidden (Spokane CEO vs Columbia)', async ({ browser }) => {
    const columbiaId = await getColumbiaSchoolId()

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, ACCOUNTS.spokaneArts)
    const spokaneId = await getCurrentSchoolId(page)
    expect(spokaneId, 'Should have Spokane school id in sessionStorage').toBeTruthy()
    expect(spokaneId).not.toBe(columbiaId)
    const apiCtx: APIRequestContext = ctx.request

    for (const { path } of ENDPOINTS) {
      // B) Own school → NOT 401/403. Endpoint may return 200 (seeded), 404 (no scenarios yet
      // on calculate), or 500 on downstream errors, but the auth gate must pass.
      const okRes = await apiCtx.post(path, { data: { schoolId: spokaneId } })
      expect([401, 403]).not.toContain(okRes.status())

      // C) Cross-school → 403.
      const xRes = await apiCtx.post(path, { data: { schoolId: columbiaId } })
      expect(xRes.status(), `${path} cross-school should be 403`).toBe(403)
    }

    await ctx.close()
  })
})
