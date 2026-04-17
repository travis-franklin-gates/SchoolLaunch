import { test, expect, ACCOUNTS, loginAs, downloadCommissionExcel, readCashFlowTab, readPLRowYear } from './fixtures'
import * as path from 'path'
import * as fs from 'fs'
import * as XLSX from 'xlsx'

/**
 * Suite 3 — Commission Excel Cash Flow distribution (Fix 3).
 *
 * The CASH FLOW tab aggregates all Y1 revenue into a single "Revenue" row (monthly totals).
 * Fix 3 changed how those monthly totals are computed — from a naive `total × OSPI%` formula
 * to a per-revenue-type distribution driven by `distributeRevenueToMonths()`.
 *
 * What we can verify from the aggregate "Revenue" row:
 *  1. 12 months are present in OSPI order (Sep → Aug).
 *  2. The sum of monthly Revenue equals (within rounding) the Year 1 Total Revenue from P&L.
 *  3. The monthly shape is NOT `total * OSPI_PCT` (the old buggy behavior) — if the school has
 *     federal grants, categoricals, or food service revenue, the curve deviates from OSPI-only.
 *     We assert at least one month's value is NOT within 1% of (y1Total × OSPI_PCT).
 *
 * Structural checks on the REVENUE tab confirm the per-type inputs actually exist.
 */

const ARTIFACT_DIR = path.resolve(process.cwd(), 'tests', 'session1', 'artifacts')
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

const WA_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
const OSPI_PCTS = [9, 8, 5, 9, 8.5, 9, 9, 9, 5, 6, 12.5, 10]

function readRevenueY1ByLabel(xlsxPath: string, label: string): number | null {
  const wb = XLSX.readFile(xlsxPath)
  const sheet = wb.Sheets['REVENUE']
  if (!sheet) return null
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null }) as unknown as (string | number | null)[][]
  for (const r of rows) {
    const desc = r[2]
    if (typeof desc === 'string' && desc.trim().toLowerCase() === label.trim().toLowerCase()) {
      // Columns: #, Source, Description, Driver, Year 0, Year 1, ...
      const v = r[5]
      return typeof v === 'number' ? v : null
    }
  }
  return null
}

test.describe('Suite 3 — Commission Excel CASH FLOW distribution (WA charter)', () => {
  test('Spokane Arts: monthly revenue curve matches per-revenue-type distribution', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    const xlsxPath = path.join(ARTIFACT_DIR, 'spokaneArts_cashflow.xlsx')
    await downloadCommissionExcel(page, '', xlsxPath)

    const cf = readCashFlowTab(xlsxPath)

    // 1) 12 months present in OSPI order.
    expect(cf.months.length).toBe(12)
    expect(cf.months.map((m) => m.trim())).toEqual(WA_MONTHS)

    // 2) Revenue row sums to Y1 total revenue (from P&L "Total Revenue" row).
    const revenueRow = cf.rows.find((r) => /^revenue$/i.test(r.label.trim()))
    expect(revenueRow, 'CASH FLOW should have a "Revenue" row').toBeTruthy()
    const monthlySum = revenueRow!.values.reduce((a, b) => a + b, 0)
    const y1TotalRev = readPLRowYear(xlsxPath, 'Total Revenue', 1)
    expect(y1TotalRev, 'P&L should expose Y1 Total Revenue').not.toBeNull()
    // Per-type rounding in distributeRevenueToMonths can produce a few dollars of drift per
    // revenue type. Allow $20 tolerance across 6 revenue buckets × 12 months.
    expect(Math.abs(monthlySum - (y1TotalRev as number))).toBeLessThanOrEqual(20)

    // 3) Per-revenue-type distribution: read each Y1 revenue input, compute expected monthly
    //    curve, and compare against the actual Revenue row month-by-month.
    const regEd = readRevenueY1ByLabel(xlsxPath, 'Regular Ed Per Pupil') ?? 0
    const sped = readRevenueY1ByLabel(xlsxPath, 'SPED Apportionment') ?? 0
    const stateSped = readRevenueY1ByLabel(xlsxPath, 'State Special Education') ?? 0
    const facRev = readRevenueY1ByLabel(xlsxPath, 'Facilities Per Pupil') ?? 0
    const sse = readRevenueY1ByLabel(xlsxPath, 'Small School Enhancement') ?? 0
    const levy = readRevenueY1ByLabel(xlsxPath, 'Levy Equity') ?? 0
    const titleI = readRevenueY1ByLabel(xlsxPath, 'Title I') ?? 0
    const idea = readRevenueY1ByLabel(xlsxPath, 'IDEA (Federal Special Ed)') ?? 0
    const lap = readRevenueY1ByLabel(xlsxPath, 'LAP (Learning Assistance)') ?? 0
    const lapHP = readRevenueY1ByLabel(xlsxPath, 'LAP High Poverty') ?? 0
    const tbip = readRevenueY1ByLabel(xlsxPath, 'TBIP (Bilingual)') ?? 0
    const hicap = readRevenueY1ByLabel(xlsxPath, 'Highly Capable') ?? 0
    const foodRev = readRevenueY1ByLabel(xlsxPath, 'Food Service (NSLP)') ?? 0
    const transRev = readRevenueY1ByLabel(xlsxPath, 'Transportation (State)') ?? 0
    const interest = readRevenueY1ByLabel(xlsxPath, 'Interest & Other Income') ?? 0

    const stateApport = regEd + sped + stateSped + facRev + sse + levy
    const federal = titleI + idea
    const stateCat = lap + lapHP + tbip + hicap
    const foodTransport = foodRev + transRev
    // Startup grants unknown here; Y1 startup grant amount isn't on REVENUE tab.
    // Allow leftover = actual(Sep) - predicted(Sep without grants) as implicit grant amount,
    // then validate it's non-negative and accounts for the Sep spike.

    const expected = WA_MONTHS.map((_m, idx) => {
      let amt = stateApport * OSPI_PCTS[idx] / 100
      if (idx >= 1 && idx <= 10) amt += federal / 10
      amt += stateCat / 12
      if (idx >= 0 && idx <= 9) amt += foodTransport / 10
      amt += interest / 12
      return Math.round(amt)
    })

    // Sep anomaly: actual Sep may include startup grant lump sum. Compute residual.
    const actual = revenueRow!.values
    const sepDelta = actual[0] - expected[0]
    expect(sepDelta, 'Sep residual (startup grants) must be non-negative').toBeGreaterThanOrEqual(-2)

    // Non-Sep months must match expected within $5 (rounding slack across 5 buckets).
    for (let i = 1; i < 12; i++) {
      expect(Math.abs(actual[i] - expected[i]), `Month ${WA_MONTHS[i]} differs: actual=${actual[i]} expected=${expected[i]}`).toBeLessThanOrEqual(5)
    }

    // Verify curve is NOT the old buggy `y1Total × OSPI_PCT` behavior:
    // compute that alternative and require at least one month to diverge by >$100.
    const naive = WA_MONTHS.map((_m, idx) => Math.round((y1TotalRev as number) * OSPI_PCTS[idx] / 100))
    const anyDiverges = actual.some((v, i) => Math.abs(v - naive[i]) > 100)
    expect(anyDiverges, 'Monthly curve must NOT equal the pre-Fix3 naive formula').toBe(true)

    // Log summary for verification report.
    // eslint-disable-next-line no-console
    console.log('[suite3:spokaneArts] monthly revenue:', JSON.stringify(actual))
    // eslint-disable-next-line no-console
    console.log('[suite3:spokaneArts] predicted     :', JSON.stringify(expected))
    // eslint-disable-next-line no-console
    console.log(`[suite3:spokaneArts] Sep residual (implicit startup grants) = $${sepDelta}`)
  })

  test('Cash Flow curve is NOT the pre-Fix3 naive OSPI-on-total formula', async ({ page }) => {
    await loginAs(page, ACCOUNTS.spokaneArts)
    const xlsxPath = path.join(ARTIFACT_DIR, 'spokaneArts_cashflow.xlsx')
    if (!fs.existsSync(xlsxPath)) {
      await downloadCommissionExcel(page, '', xlsxPath)
    }
    const cf = readCashFlowTab(xlsxPath)
    const revenueRow = cf.rows.find((r) => /^revenue$/i.test(r.label.trim()))!
    const y1TotalRev = readPLRowYear(xlsxPath, 'Total Revenue', 1)!

    // Pre-Fix3: every month = y1TotalRev × OSPI_PCT. Under the new per-type distribution, at
    // least SEVERAL months must diverge significantly (>$1000) from that naive curve —
    // because federal grants shift out of Sep/Nov/May, food/transport shifts out of Jul/Aug,
    // and startup grants stack into Sep.
    const naive = WA_MONTHS.map((_m, idx) => Math.round(y1TotalRev * OSPI_PCTS[idx] / 100))
    const divergentMonths = revenueRow.values.filter((v, i) => Math.abs(v - naive[i]) > 1000).length
    expect(divergentMonths, 'Several months should diverge from naive OSPI-on-total curve').toBeGreaterThanOrEqual(3)

    // Specifically: Aug (idx 11) under the new formula has NO federal (Oct-Jul only), NO
    // food/transport (Sep-Jun only), NO startup (Sep only). So Aug revenue = (stateApport +
    // levy) × 10% + stateCat/12 + interest/12. That must be STRICTLY LESS than the naive
    // value (which would also add 10% × federal + 10% × food/transport + 10% × startup).
    const titleI = readRevenueY1ByLabel(xlsxPath, 'Title I') ?? 0
    const idea = readRevenueY1ByLabel(xlsxPath, 'IDEA (Federal Special Ed)') ?? 0
    const foodRev = readRevenueY1ByLabel(xlsxPath, 'Food Service (NSLP)') ?? 0
    const transRev = readRevenueY1ByLabel(xlsxPath, 'Transportation (State)') ?? 0
    const shiftedOutOfAug = titleI + idea + foodRev + transRev
    if (shiftedOutOfAug > 0) {
      expect(revenueRow.values[11], 'Aug actual should be less than naive (federal+food shifted away from Aug)')
        .toBeLessThan(naive[11])
    }
  })
})
