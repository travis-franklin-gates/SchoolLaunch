import { test, expect, ACCOUNTS, loginAs, parseCurrency, downloadCommissionExcel, readPLRowYear } from './fixtures'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Suite 1 — Cross-surface state apportionment consistency (Fix 1).
 *
 * Verifies that the Y1 Authorizer Fee shown on Multi-Year and the Commission Excel P&L
 * tab agree within $1 — which is only true if both surfaces are using the canonical
 * `stateApportionmentBase(rev, sse)` helper added in Fix 1.
 *
 * Surfaces handled:
 *  - Multi-Year:    canonical live compute (computeMultiYearDetailed).
 *  - Excel P&L:     canonical live compute (same engine, serialized to XLSX).
 *  - Operations:    NOT asserted. This surface reads persisted `budget_projections` amounts
 *                   rather than live-computing, so it naturally drifts whenever enrollment /
 *                   revenue mix changes after the last save. We still capture its value for
 *                   reporting purposes (helpful to detect when the persisted value has
 *                   drifted and should be resaved).
 *  - Dashboard Overview, Scenarios, Settings, Excel CASH FLOW: no per-line authorizer fee
 *                   exposed, so excluded by design.
 */

const ARTIFACT_DIR = path.resolve(process.cwd(), 'tests', 'session1', 'artifacts')
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

async function captureMultiYearAuthorizerFee(page: import('@playwright/test').Page): Promise<number | null> {
  await page.goto('/dashboard/multiyear')
  await page.waitForSelector('[data-tour="multiyear-table"]', { timeout: 15_000 }).catch(() => {})
  // Find the "Authorizer Fee" row and extract Year 1 (first data column after the label).
  const row = page.locator('tr', { hasText: 'Authorizer Fee' }).first()
  await row.waitFor({ timeout: 10_000 }).catch(() => {})
  const cells = row.locator('td, th')
  const count = await cells.count()
  if (count < 2) return null
  // Column 0 = label, column 1 = Year 1 value
  const y1Text = (await cells.nth(1).innerText()).trim()
  return parseCurrency(y1Text)
}

async function captureOperationsAuthorizerFee(page: import('@playwright/test').Page): Promise<number | null> {
  await page.goto('/dashboard/operations')
  await page.waitForSelector('[data-tour="authorizer-fee"]', { timeout: 15_000 }).catch(() => {})
  const row = page.locator('tr[data-tour="authorizer-fee"]')
  if (await row.count() === 0) return null
  // The amount cell is the last <td>. It contains a <span> with currency text (read-only row).
  const amountCell = row.locator('td').last()
  const text = (await amountCell.innerText()).trim()
  return parseCurrency(text)
}

test.describe('Suite 1 — Cross-surface Y1 authorizer fee consistency', () => {
  for (const accountKey of ['spokaneArts', 'columbiaValley'] as const) {
    test(`${ACCOUNTS[accountKey].label} — Multi-Year, Operations, Excel P&L agree`, async ({ page }) => {
      await loginAs(page, ACCOUNTS[accountKey])

      const multiYearFee = await captureMultiYearAuthorizerFee(page)
      const operationsFee = await captureOperationsAuthorizerFee(page)

      expect(multiYearFee, 'Multi-Year should expose Y1 Authorizer Fee').not.toBeNull()
      expect(operationsFee, 'Operations should expose Authorizer Fee (for reporting)').not.toBeNull()

      // Excel P&L: trigger download from dashboard Overview, parse Year 1 cell of the
      // "Authorizer Fee" row. Year indexing: Year 0 is column 1 → yearIndex=1 means column 2.
      const xlsxPath = path.join(ARTIFACT_DIR, `${accountKey}_commission.xlsx`)
      await downloadCommissionExcel(page, '', xlsxPath)
      const excelY1 = readPLRowYear(xlsxPath, 'Authorizer Fee', 1)
      expect(excelY1, 'Excel P&L Authorizer Fee Y1 cell should be numeric').not.toBeNull()

      const my = multiYearFee as number
      const op = operationsFee as number
      const xl = excelY1 as number
      // eslint-disable-next-line no-console
      console.log(`[suite1:${accountKey}] MultiYear=$${my}  Operations=$${op}(persisted)  Excel=$${xl}`)

      // Core canonical assertion: Multi-Year and Excel P&L must agree (both live-compute).
      expect(Math.abs(my - xl), `Multi-Year vs Excel P&L: $${my} vs $${xl}`).toBeLessThanOrEqual(1)
    })
  }
})
