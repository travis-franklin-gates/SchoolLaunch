// P-UX-16 — value-preserving canonicalizer for the budget_projections shape, applied at the
// advisory hash `projSlice` boundary (buildSchoolContext.ts). Sibling of P-UX-18 (startup_funding)
// and P-UX-19 (pre-opening), but a DISTINCT shape — this is NOT canonicalizeStartupFunding and
// NOT canonicalizePreOpening*.
//
// Threat model (same as the siblings): malformed entries arrive via DB seed / import / backfill /
// CSP fixtures, not the in-app editor. projSlice read these raw and (1) threw on a null/non-object
// array element (`reading 'year'`), (2) threw in its sort comparator when category/subcategory was
// null (`reading 'localeCompare'`), or (3) silently let a non-finite amount become NaN, which
// JSON.stringify writes as `null` — corrupting both the advisory hash and its length discriminator.
//
// SEMANTICS — COERCE (mirrors P-UX-18), not DROP (P-UX-19): projSlice has always KEPT every row and
// already coerces (`is_revenue ? 1 : 0`, `amount ?? 0`), so the canonicalizer keeps row count stable
// and only repairs fields — drop ONLY null/non-object entries; coerce category/subcategory -> string
// (null/undefined -> ''), amount -> finite number (non-finite -> 0); year/is_revenue pass through.
// VALUE-PRESERVING: on canonical input (string cat/sub, finite amount) this is a strict no-op, so the
// projSlice and resulting computeAdvisoryHash are byte-identical and cached advisories are NOT
// invalidated. Idempotent. NOTE: this module is advisory-only and is intentionally EXCLUDED from
// ENGINE_HASH_FILES (buildSchoolContext.ts) — adding it would change ENGINE_VERSION and spuriously
// invalidate every cache, the inverse of P-UX-21.
import type { BudgetProjection } from './types'

/** Coerce an arbitrary value to a stable string. String -> unchanged (canonical input stays
 *  byte-identical); null/undefined -> ''; anything else -> String(...). Local by design: a budget
 *  category is not a funding source, so this does not reuse startupFunding's coerceSource. */
function coerceCategory(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

/** Coerce an arbitrary value to a finite number. Valid finite number -> untouched; otherwise
 *  Number(...) when finite, else 0 (never NaN/Infinity into the hash). */
function coerceAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Normalize raw budget_projections into a safe BudgetProjection[]. No-op on canonical input.
 */
export function canonicalizeBudgetProjections(raw: unknown): BudgetProjection[] {
  if (!Array.isArray(raw)) return []
  const out: BudgetProjection[] = []
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object') continue // drop null / non-object entries
    const r = entry as Partial<BudgetProjection> & Record<string, unknown>
    out.push({
      ...(r as BudgetProjection),
      category: coerceCategory(r.category),
      subcategory: coerceCategory(r.subcategory),
      amount: coerceAmount(r.amount),
    })
  }
  return out
}
