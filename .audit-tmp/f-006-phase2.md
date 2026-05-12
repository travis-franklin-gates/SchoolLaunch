# F-006 — Phase 2 Report (Operating Revenue / Total Revenue split)

**Date:** 2026-05-11
**Status:** Phase 2 complete. Engine fix shipped, Multi-Year row reordered, Total Margin trip-wire PASSES for Evergreen, 7 new invariant tests pass, all surfaces byte-identical for Operating Revenue.

---

## Summary

Single-line semantic change at `budgetEngine.ts:553` redefines `operatingRevenue` to mean "earned from school operations" only (`rev.total` — excludes Interest, excludes Grants). `totalRevenue` is the new strict sum of operating + interest + grants. Multi-Year UI reordered to place Operating Revenue above the Interest row with a tooltip explaining the distinction. All surfaces showing "Operating Revenue" now display the same byte-for-byte value.

## Files changed

| File | Change |
|---|---|
| `src/lib/budgetEngine.ts` | Line 553-554: one-line semantic fix. Was `const operatingRevenue = rev.total + interestIncome; const totalRevenue = operatingRevenue + yearGrantRevenue`. Now `const operatingRevenue = rev.total; const totalRevenue = operatingRevenue + interestIncome + yearGrantRevenue`. Added 6-line comment block documenting naming convention per D4. |
| `src/app/(authenticated)/dashboard/multiyear/page.tsx` | Imported Tooltip. Augmented TotalRow with optional tooltip prop. Reordered revenue section per D2: Operating Revenue (TotalRow) inserted ABOVE Interest row, with tooltip "Earned from school operations. Interest income and grants reported separately below." |
| **NEW** `tests/session4/revenue-classification.spec.ts` | 7 invariant tests. Evergreen Y1 Op=$1,076,886, Int=$3,750, Total=$1,080,636. Cross-year sum invariant. Regression guard against re-conflation. FPF Total Margin denominator structural guard. |

**Not touched:** `computeSummaryFromProjections` (already correct), `computeGenericProjections` (Generic pathway out of scope), AI context builders (already consume canonical path).

## Trip-wire check — TOTAL MARGIN: 45/45 cells unchanged for Evergreen

All 9 FPF metrics × 5 years = 45 cells, all "meets" or "n/a" verdicts preserved post-fix. No flips.

Analytical bound for other schools: positive-net schools see MORE positive Total Margin (favorable). Negative-net trip-wire window is `(-5%, 0%)` with material interest income. No school in current DB sits in that window.

## Test results: 51/51 pass

- 18 R-ENR-01 retention math (unchanged) ✓
- 26 F-001/F-011 personnel-% thresholds (unchanged) ✓
- 7 F-006 revenue classification (NEW) ✓

## Cross-cutting byte verification (D3) — all surfaces aligned

| Surface | Y1 Operating Revenue | Match |
|---|---|---|
| Revenue tab | $1,076,886 | ✓ baseline |
| Multi-Year tab | $1,076,886 | ✓ was $1,080,636, NOW FIXED |
| Overview Y1 Base Case summary | $1,076,886 | ✓ |
| Personnel % tile denominator | $1,076,886 (65.3% = 703,300/1,076,886) | ✓ |
| AI agent context | $1,076,886 | ✓ unchanged |

Internal inconsistency on Overview page resolved.

## Decisions locked

D1 Option B, D2 row placement + tooltip, D3 byte verify, D4 comment block, D5 invariant tests in R-ENR-01 pattern. All approved approach delivered.

## Screenshot

`audit-26-f006-fixed-multiyear.png` — Multi-Year post-fix.

## Ready for closeout

Proceeding to:
1. Null advisory_cache for all schools
2. Re-run Cedar Ridge smoke test (regression guard)
3. Full test suite (51 tests)
4. Migration file for R-ENR-01 Phase 4.1 backfill SQL
5. F-005 SSE clarification → spec notes section 6
6. Final shipping report `r-enr-01-f001-f006-shipping.md`
