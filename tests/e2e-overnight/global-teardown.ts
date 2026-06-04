import { appendFileSync, writeFileSync } from 'node:fs'
import { restoreAndVerify } from './_guard'

// GUARANTEED restore of test-columbia, run even if the suite crashed/timed out. Re-reads
// the row and records before/after. A failed restore is written loudly for the report.
export default async function globalTeardown() {
  const log = (m: string) => { try { appendFileSync('tests/e2e-overnight/run.log', `${new Date().toISOString()} | ${m}\n`) } catch {} }
  try {
    const { ok, row } = await restoreAndVerify()
    const result = { restoreOk: ok, facility_financing: row.facility_financing, custom_revenue_lines: (row.custom_revenue_lines || []).length, custom_expense_lines: (row.custom_expense_lines || []).length, pct_frl: row.pct_frl, onboarding_complete: row.onboarding_complete }
    writeFileSync('tests/e2e-overnight/_snapshot/test-columbia-after.json', JSON.stringify(result, null, 2))
    log(`globalTeardown RESTORE ${ok ? 'OK' : 'FAILED (ALARM)'}: ${JSON.stringify(result)}`)
  } catch (e) {
    log('globalTeardown RESTORE FATAL (ALARM): ' + String(e))
    writeFileSync('tests/e2e-overnight/_snapshot/test-columbia-after.json', JSON.stringify({ restoreOk: false, error: String(e) }, null, 2))
  }
}
