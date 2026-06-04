import { test, expect } from '@playwright/test'
import { computeMultiYearDetailed, computeFPFScorecard } from '../../src/lib/budgetEngine'
import type { SchoolProfile, StaffingPosition, BudgetProjection } from '../../src/lib/types'
import { DEFAULT_ASSUMPTIONS } from '../../src/lib/types'

/**
 * R-REV-07 - custom non-personnel expense lines (WA Charter), incl the pct_revenue
 * driver (Management Company Fee). Verifies the ratio drivers, pct_revenue computed
 * off the finalized recurring operating-revenue base in the authorizerFee slot,
 * no compounding across multiple pct_revenue lines, perYearOverrides, the
 * revenue-finalized-before-pct ordering, byte-identical no-custom output, and FPF.
 *
 * Run: npx playwright test tests/session4/custom-expense-lines.spec.ts
 */

const OPS = 1 + DEFAULT_ASSUMPTIONS.ops_escalator_pct / 100 // 1.02

function waProfile(opts?: { rev?: unknown; exp?: unknown }): SchoolProfile {
  const p: Record<string, unknown> = {
    school_id: '00000000-0000-0000-0000-0000000000bb',
    region: 'Seattle', planned_open_year: 2027, grade_config: 'K-5',
    target_enrollment_y1: 100, target_enrollment_y2: 120, target_enrollment_y3: 140,
    target_enrollment_y4: 160, target_enrollment_y5: 180,
    max_class_size: 24, pct_frl: 40, pct_iep: 12, pct_ell: 10, pct_hicap: 5,
    onboarding_complete: true, financial_assumptions: {}, retention_rate: 1.0,
  }
  if (opts?.rev !== undefined) p.custom_revenue_lines = opts.rev
  if (opts?.exp !== undefined) p.custom_expense_lines = opts.exp
  return p as unknown as SchoolProfile
}
const POSITIONS: StaffingPosition[] = [
  { school_id: 'x', year: 1, title: 'Principal', category: 'admin', fte: 1, annual_salary: 120000, position_type: 'principal', classification: 'Administrative', driver: 'fixed', students_per_position: 0 },
]
const PROJECTIONS: BudgetProjection[] = [
  { school_id: 'x', year: 1, category: 'Operations', subcategory: 'Facilities', amount: 120000, is_revenue: false },
]
function runWa(opts?: { rev?: unknown; exp?: unknown }) {
  return computeMultiYearDetailed(waProfile(opts), POSITIONS, PROJECTIONS, DEFAULT_ASSUMPTIONS, 0)
}
function expAmounts(rows: ReturnType<typeof runWa>, id: string): number[] {
  return rows.map((r) => (r.operations.customExpense || []).find((c) => c.id === id)?.amount ?? 0)
}

test.describe('R-REV-07 - custom expense lines (WA Charter)', () => {
  test('ratio drivers: per_pupil scales by enrollment x ops inflation; flat/inflation/per_fte', () => {
    const rows = runWa({ exp: [
      { id: 'pp', name: 'Per Pupil', group: 'School Operations', driver: 'per_pupil', amountY1: 10000 },
      { id: 'flat', name: 'Flat', group: 'School Operations', driver: 'flat', amountY1: 5000 },
      { id: 'infl', name: 'Inflation', group: 'Facility O&M', driver: 'inflation', amountY1: 8000 },
      { id: 'fte', name: 'Per FTE', group: 'Contracted Services', driver: 'per_fte', amountY1: 6000 },
    ] })
    expect(expAmounts(rows, 'pp')[0]).toBe(10000)
    expect(expAmounts(rows, 'pp')[1]).toBe(Math.round(10000 * (120 / 100) * OPS))
    expect(expAmounts(rows, 'flat')).toEqual([5000, 5000, 5000, 5000, 5000])
    expect(expAmounts(rows, 'infl')[1]).toBe(Math.round(8000 * OPS))
    expect(expAmounts(rows, 'fte')[1]).toBe(Math.round(6000 * OPS)) // FTE ratio 1 (no allPositions)
  })

  test('pct_revenue (Management Company Fee) = rate% x finalized recurring operating revenue', () => {
    const rows = runWa({ exp: [{ id: 'mgmt', name: 'Management Company Fee', group: 'Contracted Services', driver: 'pct_revenue', rate: 10 }] })
    for (let i = 0; i < rows.length; i++) {
      const base = rows[i].revenue.operatingRevenue // no custom revenue here -> = rev.total
      expect(expAmounts(rows, 'mgmt')[i]).toBe(Math.round((10 / 100) * base))
    }
  })

  test('two pct_revenue lines read the SAME base (no compounding, no order dependence)', () => {
    const rows = runWa({ exp: [
      { id: 'a', name: 'A', group: 'Contracted Services', driver: 'pct_revenue', rate: 5 },
      { id: 'b', name: 'B', group: 'Contracted Services', driver: 'pct_revenue', rate: 5 },
    ] })
    const base = rows[0].revenue.operatingRevenue
    expect(expAmounts(rows, 'a')[0]).toBe(Math.round(0.05 * base))
    expect(expAmounts(rows, 'b')[0]).toBe(Math.round(0.05 * base))
    // identical rate -> identical amount (b not computed off a base reduced by a)
    expect(expAmounts(rows, 'a')[0]).toBe(expAmounts(rows, 'b')[0])
  })

  test('ordering: a recurring custom REVENUE line raises the base a pct_revenue EXPENSE reads', () => {
    const exp = [{ id: 'mgmt', name: 'Mgmt Fee', group: 'Contracted Services', driver: 'pct_revenue', rate: 10 }]
    const without = runWa({ exp })
    const withRev = runWa({
      rev: [{ id: 'r', name: 'Recurring Rev', group: 'Federal', driver: 'flat', amountY1: 500000, recurring: true }],
      exp,
    })
    // operatingRevenue base is higher with the recurring revenue line...
    expect(withRev[0].revenue.operatingRevenue).toBe(without[0].revenue.operatingRevenue + 500000)
    // ...so the pct_revenue expense computed against it is correspondingly higher.
    expect(expAmounts(withRev, 'mgmt')[0]).toBe(Math.round(0.10 * withRev[0].revenue.operatingRevenue))
    expect(expAmounts(withRev, 'mgmt')[0]).toBeGreaterThan(expAmounts(without, 'mgmt')[0])
  })

  test('perYearOverrides supersedes the driver for that year', () => {
    const rows = runWa({ exp: [{ id: 'ov', name: 'Override', group: 'School Operations', driver: 'flat', amountY1: 1000, perYearOverrides: { 2: 77777 } }] })
    expect(expAmounts(rows, 'ov')[0]).toBe(1000)
    expect(expAmounts(rows, 'ov')[1]).toBe(77777)
    expect(expAmounts(rows, 'ov')[2]).toBe(1000)
  })

  test('custom expense folds into totalOperations -> totalExpenses', () => {
    const base = runWa({ exp: [] })
    const withExp = runWa({ exp: [{ id: 'e', name: 'E', group: 'School Operations', driver: 'flat', amountY1: 40000 }] })
    expect(withExp[0].operations.total).toBe(base[0].operations.total + 40000)
    expect(withExp[0].totalExpenses).toBe(base[0].totalExpenses + 40000)
    // contingency unchanged (custom expense added after the contingency base)
    expect(withExp[0].operations.contingency).toBe(base[0].operations.contingency)
  })

  test('FPF: a custom expense line moves totalExpenses and lowers Days of Cash', () => {
    const baseRows = runWa({ exp: [] })
    const expRows = runWa({ exp: [{ id: 'e', name: 'E', group: 'Facility O&M', driver: 'flat', amountY1: 200000 }] })
    const days = (rows: ReturnType<typeof runWa>) =>
      computeFPFScorecard(rows, 250000, false).measures.find((m) => m.name === 'Days of Cash')!.values[0] ?? 0
    expect(expRows[0].totalExpenses).toBe(baseRows[0].totalExpenses + 200000)
    expect(days(expRows)).toBeLessThan(days(baseRows))
  })

  test('no-custom byte-identical: empty/absent custom_expense_lines produce identical output', () => {
    const empty = runWa({ exp: [] })
    const absent = runWa(undefined)
    expect(JSON.stringify(absent)).toBe(JSON.stringify(empty))
    expect(empty[0].operations.customExpense).toEqual([])
  })

  test('legacy {key,label,amount} expense entry reads as a flat line', () => {
    const rows = runWa({ exp: [{ key: 'legacy_e', label: 'Legacy Expense', amount: 3210 }] })
    const line = (rows[0].operations.customExpense || [])[0]
    expect(line.name).toBe('Legacy Expense')
    expect(line.amount).toBe(3210)
  })
})
