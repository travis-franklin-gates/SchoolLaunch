// P-UX-19 — value-preserving canonicalizers for the pre-opening shapes, applied at the
// engine boundary (computeCarryForward). Sibling of P-UX-18 (startup_funding) one layer
// over, but DISTINCT shapes — these are NOT canonicalizeStartupFunding.
//
// Threat model (same as P-UX-18): malformed entries arrive via DB seed / import / backfill /
// CSP fixtures, not the in-app editor. computeCarryForward read these raw and crashed on a
// null entry (`reading 'amount'`/`'budgeted'`) or silently corrupted the sum when a numeric
// field was non-finite (NaN/string -> the `> 0` fallback wrongly used the budget path).
//
// SEMANTICS: DROP any entry that is null / non-object / whose numeric field (amount for
// transactions, budgeted for expenses) is not ALREADY a finite number. Do NOT coerce a
// non-finite value to 0 — dropping vs zeroing changes the carry-forward sum, and a fabricated
// $0 line is its own corruption. Well-formed entries pass through BYTE-IDENTICAL (filtered,
// never remapped), so the canonicalizers are a strict no-op on canonical data and idempotent.
import type { PreOpeningTransaction, PreOpeningExpense } from './types'

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Drop null/non-object/non-finite-`amount` entries; keep well-formed transactions as-is. */
export function canonicalizePreOpeningTransactions(raw: unknown): PreOpeningTransaction[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is PreOpeningTransaction =>
      e != null && typeof e === 'object' && isFiniteNumber((e as PreOpeningTransaction).amount),
  )
}

/** Drop null/non-object/non-finite-`budgeted` entries; keep well-formed expenses as-is. */
export function canonicalizePreOpeningExpenses(raw: unknown): PreOpeningExpense[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is PreOpeningExpense =>
      e != null && typeof e === 'object' && isFiniteNumber((e as PreOpeningExpense).budgeted),
  )
}
