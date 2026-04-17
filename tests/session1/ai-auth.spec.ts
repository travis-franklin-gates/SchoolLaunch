import { test, expect, ACCOUNTS, loginAs, getCurrentSchoolId, getSupabaseService } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

/**
 * Suite 4 — AI endpoint authentication (Fix 4).
 *
 * Verifies that all five AI-adjacent endpoints require auth + school access:
 *   /api/advisory, /api/chat, /api/alignment, /api/export/narrative, /api/export/commission
 *
 * Scenarios:
 *   A) Unauthenticated POST → 401
 *   B) Authenticated user POSTing their own schoolId → 200 (or at least not 401/403)
 *   C) Authenticated user POSTing a DIFFERENT school's schoolId → 403
 *   D) Missing schoolId → 400
 *
 * For C we use the Spokane Arts CEO session against Columbia Valley's schoolId.
 */

const ENDPOINTS = [
  { path: '/api/advisory', needsSchoolContext: true },
  { path: '/api/chat', needsSchoolContext: true },
  { path: '/api/alignment', needsSchoolContext: true },
  { path: '/api/export/narrative', needsSchoolContext: true },
  { path: '/api/export/commission', needsSchoolContext: true },
] as const

function minimalBody(endpoint: string, schoolId: string): Record<string, unknown> {
  const base = {
    schoolId,
    schoolName: 'Test',
    profile: { pct_frl: 0, pct_iep: 0, pct_ell: 0, grade_config: 'K-5' },
    assumptions: { benefits_load_pct: 30, aafte_pct: 100 },
    positions: [],
    multiYear: [],
    scorecard: { measures: [] },
    startingCash: 0,
  }
  if (endpoint === '/api/chat') {
    return { schoolId, messages: [{ role: 'user', content: 'ping' }], schoolContext: '' }
  }
  if (endpoint === '/api/advisory') {
    return { schoolId, agent: 'commissionReviewer', schoolContext: '', schoolData: {} }
  }
  if (endpoint === '/api/alignment') {
    return { schoolId, documents: [], schoolContext: '' }
  }
  return base
}

async function getColumbiaSchoolId(): Promise<string> {
  const supabase = getSupabaseService()
  // Owner of the columbiaValley account owns Columbia Valley Charter.
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

test.describe('Suite 4 — AI endpoint authentication', () => {
  test('A) Unauthenticated requests are rejected 401', async ({ request }) => {
    for (const { path } of ENDPOINTS) {
      const res = await request.post(path, { data: minimalBody(path, 'some-id') })
      expect(res.status(), `${path} unauthenticated should be 401`).toBe(401)
    }
  })

  test('D) Missing schoolId yields 400', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, ACCOUNTS.spokaneArts)
    const apiCtx: APIRequestContext = ctx.request
    for (const { path } of ENDPOINTS) {
      const body = minimalBody(path, 'x')
      delete (body as Record<string, unknown>).schoolId
      const res = await apiCtx.post(path, { data: body })
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
      // B) Own school → NOT 401/403. (May be 200, 400, or 500 depending on the endpoint's
      // downstream logic when given minimal payloads; we only care that the gate passes.)
      const okRes = await apiCtx.post(path, { data: minimalBody(path, spokaneId!) })
      expect([401, 403]).not.toContain(okRes.status())

      // C) Other school → 403.
      const xRes = await apiCtx.post(path, { data: minimalBody(path, columbiaId) })
      expect(xRes.status(), `${path} cross-school should be 403`).toBe(403)
    }

    await ctx.close()
  })
})
