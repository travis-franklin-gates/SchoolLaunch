import { test, expect } from '@playwright/test'
import { computeMultiYearDetailed, computeFPFScorecard } from '../../src/lib/budgetEngine'
import { readFacilityFinancing, annualDepreciation, annualInterest } from '../../src/lib/facilityFinancing'
import type { SchoolProfile, StaffingPosition, BudgetProjection } from '../../src/lib/types'
import { DEFAULT_ASSUMPTIONS } from '../../src/lib/types'

/**
 * P-FIN-01 (facility depreciation) + P-FIN-02 (facility debt interest) for owned/financed
 * WA Charter facilities.
 *
 * Pins to Cedar Grove's V11: $5.175M basis / 30 yr -> $172,500/yr straight-line
 * depreciation; $5.175M loan, 5%, 30 yr, MONTHLY fully-amortizing -> interest
 * $257,016 Y1 declining to $240,151 Y5 (matches V11 to the cent before rounding).
 *
 * The DCOH "both-halves" proof (D1): depreciation is non-cash, so it is subtracted from
 * the DCOH denominator AND added back to the cash numerator -> a school WITH depreciation
 * has the SAME Days of Cash (Scorecard) AND the SAME reserveDays (engine) as one without.
 * Interest is a cash cost (stays in the denominator, NOT added back) -> it DOES lower both.
 *
 * Run: npx playwright test tests/session4/facility-financing.spec.ts
 */

// Cedar Grove V11 facility financing inputs.
const CEDAR_GROVE_FF = { basis: 5175000, useful_life: 30, principal: 5175000, interest_rate: 5, term_years: 30, start_year: 1 }
// V11 interest, rounded to whole dollars as the engine folds it (P&L row 271).
const CEDAR_GROVE_INTEREST = [257016, 253110, 249004, 244688, 240151]
const CEDAR_GROVE_DEPRECIATION = 172500

function waProfile(ff?: unknown): SchoolProfile {
  const p: Record<string, unknown> = {
    school_id: '00000000-0000-0000-0000-0000000000fc',
    region: 'Seattle', planned_open_year: 2027, grade_config: 'K-5',
    target_enrollment_y1: 100, target_enrollment_y2: 120, target_enrollment_y3: 140,
    target_enrollment_y4: 160, target_enrollment_y5: 180,
    max_class_size: 24, pct_frl: 40, pct_iep: 12, pct_ell: 10, pct_hicap: 5,
    onboarding_complete: true, financial_assumptions: {}, retention_rate: 1.0,
  }
  if (ff !== undefined) p.facility_financing = ff
  return p as unknown as SchoolProfile
}
const POSITIONS: StaffingPosition[] = [
  { school_id: 'x', year: 1, title: 'Principal', category: 'admin', fte: 1, annual_salary: 120000, position_type: 'principal', classification: 'Administrative', driver: 'fixed', students_per_position: 0 },
]
const PROJECTIONS: BudgetProjection[] = [
  { school_id: 'x', year: 1, category: 'Operations', subcategory: 'Facilities', amount: 120000, is_revenue: false },
]
function runWa(ff?: unknown) {
  return computeMultiYearDetailed(waProfile(ff), POSITIONS, PROJECTIONS, DEFAULT_ASSUMPTIONS, 0)
}
const START_CASH = 250000
function dcoh(rows: ReturnType<typeof runWa>): number[] {
  return computeFPFScorecard(rows, START_CASH, false).measures.find((m) => m.name === 'Days of Cash')!.values.map((v) => v ?? 0)
}
function reserveDays(rows: ReturnType<typeof runWa>): number[] {
  return rows.map((r) => r.reserveDays)
}
function measure(rows: ReturnType<typeof runWa>, name: string): number[] {
  return computeFPFScorecard(rows, START_CASH, false).measures.find((m) => m.name === name)!.values.map((v) => v ?? 0)
}

test.describe('P-FIN-01/02 - facility financing helper (unit)', () => {
  test('depreciation = basis / useful_life, constant across years (Cedar Grove $172,500/yr)', () => {
    const ff = readFacilityFinancing(CEDAR_GROVE_FF)!
    for (let y = 1; y <= 5; y++) expect(annualDepreciation(ff, y)).toBe(CEDAR_GROVE_DEPRECIATION)
  })

  test('interest = monthly fully-amortizing schedule, matches V11 to the rounded dollar', () => {
    const ff = readFacilityFinancing(CEDAR_GROVE_FF)!
    for (let y = 1; y <= 5; y++) expect(annualInterest(ff, y)).toBe(CEDAR_GROVE_INTEREST[y - 1])
  })

  test('zero / absent financing reads as null; no depreciation or interest', () => {
    expect(readFacilityFinancing(null)).toBeNull()
    expect(readFacilityFinancing({})).toBeNull()
    expect(readFacilityFinancing('garbage')).toBeNull()
    expect(readFacilityFinancing({ basis: 0, principal: 0 })).toBeNull()
  })

  test('useful_life defaults to 30 when omitted', () => {
    const ff = readFacilityFinancing({ basis: 3000000 })!
    expect(annualDepreciation(ff, 1)).toBe(Math.round(3000000 / 30))
  })

  test('start_year gates both: zero before the financing begins', () => {
    const ff = readFacilityFinancing({ ...CEDAR_GROVE_FF, start_year: 3 })!
    expect(annualDepreciation(ff, 1)).toBe(0)
    expect(annualDepreciation(ff, 2)).toBe(0)
    expect(annualDepreciation(ff, 3)).toBe(CEDAR_GROVE_DEPRECIATION)
    expect(annualInterest(ff, 2)).toBe(0)
    expect(annualInterest(ff, 3)).toBe(CEDAR_GROVE_INTEREST[0]) // loan year 1 == projection year 3
  })

  test('zero interest_rate yields zero interest (no divide-by-zero)', () => {
    const ff = readFacilityFinancing({ principal: 1000000, interest_rate: 0, term_years: 30 })!
    expect(annualInterest(ff, 1)).toBe(0)
  })
})

test.describe('P-FIN-01/02 - engine integration', () => {
  test('engine emits per-year depreciation and interest on operations (Cedar Grove pins)', () => {
    const rows = runWa(CEDAR_GROVE_FF)
    for (let i = 0; i < 5; i++) {
      expect(rows[i].operations.depreciation).toBe(CEDAR_GROVE_DEPRECIATION)
      expect(rows[i].operations.interest).toBe(CEDAR_GROVE_INTEREST[i])
    }
  })

  test('depreciation + interest fold into totalOperations -> totalExpenses; contingency unchanged', () => {
    const base = runWa()
    const fin = runWa(CEDAR_GROVE_FF)
    const add = CEDAR_GROVE_DEPRECIATION + CEDAR_GROVE_INTEREST[0]
    expect(fin[0].operations.total).toBe(base[0].operations.total + add)
    expect(fin[0].totalExpenses).toBe(base[0].totalExpenses + add)
    expect(fin[0].operations.contingency).toBe(base[0].operations.contingency)
  })

  test('Year 1 net drops by exactly depreciation + interest (-$429,516 for Cedar Grove)', () => {
    const base = runWa()
    const fin = runWa(CEDAR_GROVE_FF)
    expect(fin[0].net).toBe(base[0].net - 429516)
  })

  test('DEPRECIATION-NEUTRAL (both halves): dep-only leaves DCOH and reserveDays identical', () => {
    const base = runWa()
    const depOnly = runWa({ basis: 600000, useful_life: 30 }) // 20,000/yr depreciation, no loan
    expect(dcoh(depOnly)).toEqual(dcoh(base))         // Scorecard DCOH unchanged
    expect(reserveDays(depOnly)).toEqual(reserveDays(base)) // engine reserveDays unchanged
  })

  test('INTEREST LOWERS both DCOH and reserveDays (cash cost, not added back)', () => {
    const base = runWa()
    const intOnly = runWa({ principal: 600000, interest_rate: 5, term_years: 30 }) // interest, no basis
    const b = dcoh(base), i = dcoh(intOnly)
    const rb = reserveDays(base), ri = reserveDays(intOnly)
    for (let y = 0; y < 5; y++) {
      expect(i[y]).toBeLessThan(b[y])
      expect(ri[y]).toBeLessThan(rb[y])
    }
  })

  test('ALL cash-derived scorecard surfaces are depreciation-neutral; interest lowers them', () => {
    const base = runWa()
    const depOnly = runWa({ basis: 600000, useful_life: 30 })          // 20,000/yr depreciation
    const intOnly = runWa({ principal: 600000, interest_rate: 5, term_years: 30 }) // interest only
    for (const name of ['Current Ratio', 'Days of Cash', 'Cash Flow', 'Multi-Year Cash Flow']) {
      // depreciation (non-cash) must not move any cash-derived surface
      expect(measure(depOnly, name)).toEqual(measure(base, name))
    }
    // interest (cash cost) DOES lower the Current Ratio (non-null years)
    const cb = measure(base, 'Current Ratio'), ci = measure(intOnly, 'Current Ratio')
    for (let y = 0; y < 5; y++) expect(ci[y]).toBeLessThan(cb[y])
  })

  test('lease school (no facility_financing) is byte-identical and DCOH-identical to today', () => {
    const absent = runWa(undefined)
    const nullFf = runWa(null)
    // no new operations keys when there is no financing (byte-identical to post-R-REV-07 output)
    expect(absent[0].operations).not.toHaveProperty('depreciation')
    expect(absent[0].operations).not.toHaveProperty('interest')
    expect(JSON.stringify(nullFf)).toBe(JSON.stringify(absent))
    // FPF + reserveDays unchanged
    expect(dcoh(nullFf)).toEqual(dcoh(absent))
  })
})
