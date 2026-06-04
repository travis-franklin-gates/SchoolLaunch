import { test, expect } from '@playwright/test'
import { computeAdvisoryHash, hashProjectionInputs, PROMPT_VERSION, ENGINE_HASH_FILES } from '../../src/lib/buildSchoolContext'
import { ENGINE_VERSION } from '../../src/lib/engineVersion'
import { ENGINE_FILES, normalizeLF, engineVersionFromContents } from '../../scripts/gen-engine-version.cjs'
import { computeCarryForward } from '../../src/lib/budgetEngine'
import type { SchoolProfile, StaffingPosition, BudgetProjection, StartupFundingSource } from '../../src/lib/types'

/**
 * P-UX-21 — engine-version token folded into computeAdvisoryHash so engine-code changes
 * invalidate stale advisory caches (root cause of Divergence #2). Mechanism: build-time
 * content-hash (LF-normalized) of the number-engine file set -> ENGINE_VERSION constant.
 * Cache-key change only: no engine function touched.
 */
const FUND = (amount: number, sy?: number[], ya?: Record<number, number>): StartupFundingSource =>
  ({ source: 'X', amount, type: 'grant', status: 'projected', ...(sy ? { selectedYears: sy } : {}), ...(ya ? { yearAllocations: ya } : {}) })
const profile = (funding: StartupFundingSource[]): SchoolProfile => ({
  school_id: 'x', region: 'benton_county', planned_open_year: 2027, grade_config: 'K-5',
  target_enrollment_y1: 72, target_enrollment_y2: 96, target_enrollment_y3: 120,
  target_enrollment_y4: 144, target_enrollment_y5: 168, max_class_size: 24,
  pct_frl: 62, pct_iep: 13, pct_ell: 18, pct_hicap: 3, onboarding_complete: true,
  financial_assumptions: {}, retention_rate: 92, opening_grades: ['K', '1', '2'],
  buildout_grades: ['K', '1', '2', '3', '4', '5'], pre_opening_expenses: [], pre_opening_transactions: [],
  startup_funding: funding,
} as unknown as SchoolProfile)
const POS: StaffingPosition[] = [{ school_id: 'x', year: 1, title: 'Principal', category: 'admin', fte: 1, annual_salary: 120000, position_type: 'principal', classification: 'Administrative', driver: 'fixed', students_per_position: 0 }]
const PRJ: BudgetProjection[] = [{ school_id: 'x', year: 1, category: 'Operations', subcategory: 'Facilities', amount: 120000, is_revenue: false }]
const input = { profile: profile([FUND(350000, [0, 1, 2, 3, 4], { 0: 350000, 1: 0, 2: 0, 3: 0, 4: 0 })]), positions: POS, projections: PRJ, gradeExpansionPlan: [] }

test.describe('P-UX-21 — hash folds the engine-version token', () => {
  test('hash format is PROMPT_VERSION|ENGINE_VERSION|djb2|len (4 segments)', () => {
    const h = computeAdvisoryHash(input)
    expect(h.startsWith(`${PROMPT_VERSION}|${ENGINE_VERSION}|`)).toBe(true)
    expect(h.split('|').length).toBe(4)
  })

  test('base_data_hash (hashProjectionInputs) is the same function -> also folds the token', () => {
    expect(hashProjectionInputs(input)).toBe(computeAdvisoryHash(input))
    expect(hashProjectionInputs(input).startsWith(`${PROMPT_VERSION}|${ENGINE_VERSION}|`)).toBe(true)
  })

  test('an old 3-segment cache hash mismatches the new 4-segment format (self-heal banner)', () => {
    const oldFormat = `${PROMPT_VERSION}|deadbeef|5033`
    expect(oldFormat).not.toBe(computeAdvisoryHash(input)) // engine changes / older caches invalidate
  })
})

test.describe('P-UX-21 — content-hash generator', () => {
  test('single source: gen-script file list === documented ENGINE_HASH_FILES', () => {
    expect([...ENGINE_FILES].sort()).toEqual([...ENGINE_HASH_FILES].sort())
  })

  test('LF-normalized: CRLF and LF of the same source produce the SAME token', () => {
    const crlf = [{ name: 'a.ts', content: 'export const x = 1\r\nconst y = 2\r\n' }]
    const lf = [{ name: 'a.ts', content: 'export const x = 1\nconst y = 2\n' }]
    expect(engineVersionFromContents(crlf)).toBe(engineVersionFromContents(lf))
  })

  test('deterministic: identical input yields identical token', () => {
    const files = [{ name: 'a.ts', content: 'a\n' }, { name: 'b.ts', content: 'b\n' }]
    expect(engineVersionFromContents(files)).toBe(engineVersionFromContents([...files]))
  })

  test('sensitive: a changed tracked file yields a different token', () => {
    const base = [{ name: 'a.ts', content: 'a\n' }]
    const changed = [{ name: 'a.ts', content: 'a // edit\n' }]
    expect(engineVersionFromContents(base)).not.toBe(engineVersionFromContents(changed))
  })

  test('normalizeLF strips CR', () => {
    expect(normalizeLF('a\r\nb\rc')).toBe('a\nb\nc')
  })
})

test.describe('P-UX-21 — engine untouched (guard)', () => {
  test('computeCarryForward pins unchanged: WA 350000 / Generic 120000', () => {
    expect(computeCarryForward(profile([FUND(350000, [0, 1, 2, 3, 4], { 0: 350000, 1: 0, 2: 0, 3: 0, 4: 0 })]))).toBe(350000)
    expect(computeCarryForward(profile([FUND(120000)]))).toBe(120000)
  })
})
