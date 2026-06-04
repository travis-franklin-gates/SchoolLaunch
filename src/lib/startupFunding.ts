// P-UX-18 — single, value-preserving canonicalizer for startup_funding, shared by the
// engine (budgetEngine.ts raw readers) and the advisory hash (buildSchoolContext.ts).
//
// Why this exists: startup_funding can be built OUTSIDE the Revenue editor (direct DB
// seed, import, backfill, manual MCP edit), so entries may be null / non-object, carry a
// missing/numeric `source`, or a non-numeric `amount`. P-UX-11 hardened only the advisory
// HASH projection; the engine read RAW and crashed (computeCarryForward:107,
// getGrantRevenueForYear:63, getGrantAllocationsForYear:85). This is the one place shape
// normalization lives, so the two readers cannot drift.
//
// VALUE-PRESERVING (the contract): on canonical input this is a strict no-op — valid
// entries pass through with values untouched (no rounding, no sorting, no field drops), so
// computeMultiYearDetailed / computeCarryForward / computeAdvisoryHash stay byte-identical
// for the 25 canonical prod rows across every pathway. It ONLY removes garbage entries and
// coerces invalid fields: null/non-object entries dropped, `source` -> string, `amount` ->
// finite number (NaN/missing -> 0), `yearAllocations` kept only when a plain object.
import type { StartupFundingSource } from './types'

/**
 * Coerce an arbitrary `source` to a stable string. String -> unchanged (canonical input
 * stays byte-identical); numeric -> stringified (preserves the label); null/undefined -> ''.
 */
export function coerceSource(source: unknown): string {
  if (typeof source === 'string') return source
  if (source == null) return ''
  return String(source)
}

function coerceAmount(amount: unknown): number {
  if (typeof amount === 'number' && Number.isFinite(amount)) return amount // valid -> untouched
  const n = Number(amount)
  return Number.isFinite(n) ? n : 0
}

/**
 * Normalize raw startup_funding into a safe StartupFundingSource[]. No-op on canonical input.
 */
export function canonicalizeStartupFunding(raw: unknown): StartupFundingSource[] {
  if (!Array.isArray(raw)) return []
  const out: StartupFundingSource[] = []
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object') continue // drop null / "garbage" / non-object
    const f = entry as Partial<StartupFundingSource> & Record<string, unknown>
    const src: StartupFundingSource = {
      source: coerceSource(f.source),
      amount: coerceAmount(f.amount),
      type: f.type as StartupFundingSource['type'],
      status: f.status as StartupFundingSource['status'],
    }
    if (Array.isArray(f.selectedYears)) src.selectedYears = f.selectedYears
    if (f.yearAllocations && typeof f.yearAllocations === 'object' && !Array.isArray(f.yearAllocations)) {
      src.yearAllocations = f.yearAllocations as Record<number, number>
    }
    out.push(src)
  }
  return out
}
