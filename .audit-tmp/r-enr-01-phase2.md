# R-ENR-01 — Phase 2 Report (Engine Fix)

**Date:** 2026-05-11
**Status:** Phase 2 complete. All 18 regression tests passing. Engine fix verified end-to-end through Evergreen Heights' Multi-Year tab. Awaiting Travis greenlight on Phase 3 (UI).

---

## Summary

Engine fix (F2) and AI context prose fix (F3) shipped together. F1 (UI hardcode) deferred to Phase 3 per plan.

## Files changed

| File | Change |
|---|---|
| `src/lib/gradeExpansion.ts` | Added `RETENTION_RATE_DEFAULT = 92` named export. Added `getRetentionRate(profile)` accessor. Rewrote `computeExpansionEnrollments` with Formula A whole-year compounding. Fixed `expansionToEnrollmentArray` fill-forward bug (pre-existing, only manifested at retention=0). Doc comment block documents the math, model limitations, and the integer-percentage representation. |
| `src/lib/budgetEngine.ts` | Added `getRetentionRate` import. Replaced both `profile.retention_rate ?? 90` (lines 494, 1076) with `getRetentionRate(profile)`. |
| `src/lib/buildSchoolContext.ts` | Added `getRetentionRate` import. Replaced `?? 90` reads at lines 206, 365 with accessor. **F3 prose fix:** rewrote enrollment summary at line 213 (advisory agent context) and line 375 (Ask SchoolLaunch context) to accurately describe Formula A behavior. No more false "attrition backfilled through new student recruitment" framing. |
| `src/app/(authenticated)/dashboard/staffing/page.tsx` | Added `getRetentionRate` import. Replaced inline `?? 90` at line 285 with accessor. |
| `src/app/api/staffing/seed/route.ts` | Added `getRetentionRate` import. Replaced inline `?? 90` at line 107 with accessor. |
| `tests/session4/grade-expansion.spec.ts` | Extended imports. Added 13 new test cases covering retention math, accessor, defaults, constituent-sum invariant, new-grade isolation, compounding, and array-vs-detailed parity. Added code comment warning vs decimal-percentage representation. |

**Not touched (deferred to Phase 3):**
- `src/components/GradeExpansionEditor.tsx` (the F1 hardcode site)
- `src/app/(authenticated)/dashboard/settings/page.tsx` (Settings UI)
- `src/app/(onboarding)/onboarding/page.tsx` (onboarding write path)
- `src/components/onboarding/StepEnrollment.tsx` (onboarding step component)

## Math implementation

Formula A, whole-year compounding (per your D1 approval + numerical illustration):

```
Year 1 (founding):
  returning[1]  = 0
  newGrade[1]   = 0  (founding cohorts are not "new grade" — is_new_grade=false)
  total[1]      = sum(sections × students_per_section) across Y1 entries

Year n ≥ 2:
  newGradeStudents[n]   = sum(sections × students_per_section) for entries with is_new_grade=true
  priorContinuingTotal  = total[n-1] minus any prior grade absent from year n
                          (for pure expansion plans this subtraction is 0)
  returning[n]          = round(priorContinuingTotal × retentionRate / 100)
  total[n]              = returning[n] + newGradeStudents[n]
```

Retention compounds across years because year n uses year n-1's RESULT total, not plan capacity.

## Verification results

### Unit tests (18 passing)

All tests in `tests/session4/grade-expansion.spec.ts` pass:

- 5 pre-existing `defaultYearNewGrades` tests (unchanged behavior — confirms scope isolation)
- 9 new `computeExpansionEnrollments` tests covering:
  - retention=100 → legacy `[72, 96, 120, 144, 144]` (regression guard)
  - retention=92 → `[72, 90, 107, 122, 112]`
  - retention=90 → `[72, 89, 104, 118, 106]`
  - retention=0 → `[72, 24, 24, 24, 0]` (only new grades)
  - Default param resolves to RETENTION_RATE_DEFAULT
  - Y1 founding semantics (returning=0, newGrade=0, total=72)
  - Constituent-sum invariant: total = returning + newGrade for Y2+ across 6 retention values
  - New-grade students never reduced by retention
  - Returning students = round(prior total × r/100), confirming compounding
  - `expansionToEnrollmentArray` delegates correctly
- 3 new `getRetentionRate` accessor tests

Run command: `npx playwright test tests/session4/grade-expansion.spec.ts`
Result: 18 passed in 1.9s

### End-to-end verification on Evergreen Heights

DB patched twice (retention=90, then retention=92), Multi-Year tab refreshed each time, numbers verified:

**retention=90:**
- Total Enrollment: [72, 89, 104, 118, 106] ✓ matches unit test
- Returning Students: [—, 65, 80, 94, 106] ✓ matches Math.round(prior × 0.9)
- Year 5 < Year 4 enrollment (106 vs 118), proving retention is biting
- Y5 revenue $1,820,519 < Y4 $1,950,675 (smaller school = less revenue)

**retention=92 (engine default):**
- Total Enrollment: [72, 90, 107, 122, 112] ✓ matches unit test
- Returning Students: [—, 66, 83, 98, 112] ✓ matches Math.round(prior × 0.92)
- Operating Revenue scales: Y1 $1.08M → Y4 $2.01M → Y5 $1.92M
- Days Cash: 104 → 163 → 261 → 383 → 494

Both retention values produce a downward-sloping Y5 (vs Y4) when buildout is complete — the smoking gun that retention is being applied. Pre-fix, Y5 would have stayed flat at the buildout capacity.

### Screenshots

- `audit-10-renr01-p2-multiyear-retention92.png` — Multi-Year tab at retention=92, full page

### Critical constraint observed

Did NOT navigate to Settings → Grade Expansion editor during verification. The editor's `useEffect` at `GradeExpansionEditor.tsx:196-204` would overwrite `retention_rate=92` back to `100` on render (F1, still unfixed). Only safe surfaces visited: dashboard/multiyear. Other safe surfaces for Phase 3 verification: overview, revenue, staffing, operations, cashflow, scenarios, ask, advisory, scorecard.

## Sub-finding logged: pre-existing fill-forward bug in `expansionToEnrollmentArray`

While writing tests, the retention=0 case exposed a latent bug in `expansionToEnrollmentArray:227-245`:

- The fill-forward loop at the end used `if (result[i] === 0 && result[i-1] > 0)` to detect "year has no entries in the plan"
- But at retention=0, a year that IS in the plan can legitimately compute to 0 students (Y5 with no new grades and 0% retention)
- The fill-forward incorrectly treated computed-zero as "missing year" and copied prior year's value

Fix applied: track `yearHasEntries[]` explicitly, only fill-forward when a year is truly absent from the plan. No production impact (no school runs retention=0), but the test caught it and it's the right thing to fix. Same surface as R-ENR-01 so included in scope.

## What did NOT change

Per WA-pathway isolation constraint:
- `computeMultiYearDetailed` interface and signature unchanged (still takes profile, projections, assumptions, etc.)
- `computeGenericProjections` not touched
- Schema unchanged (no migration in Phase 2; that's Phase 4)
- No git operations performed

## Decisions that locked in during Phase 2

- Used `Math.round()` for retention math (matches D1 spec)
- `RETENTION_RATE_DEFAULT = 92` exported from `gradeExpansion.ts` (math file owns the constant)
- Accessor `getRetentionRate(profile)` accepts any `{ retention_rate?: number | null }` to allow partial profile data in seed/route etc.
- Y1 founding cohort returns `newGrade=0` and `returning=0` from the engine; the Multi-Year UI computes its own "New Grade Students" display for Y1 as `total - returning = 72`, which is a UI presentation choice independent of the engine. No engine change needed for this.

## Test fixture footgun note

Added comment block in test file warning against decimal representation (the pattern at `advisory-hash.spec.ts:39` uses `0.9`, not `90`). All new tests use integer percentage. Did NOT modify the existing hash test since it works for its purpose.

## Decisions deferred to Phase 3

- `GradeExpansionEditor.tsx:38, 64` — replace dead prop + hardcoded const with `useState(initialRetentionRate ?? RETENTION_RATE_DEFAULT)`
- Settings → Grade Expansion: add slider UI (range 70–100, step 1, default 92)
- Onboarding Step 2: add slider control (per your D4 override) positioned after the expansion timeline, before the enrollment summary
- Tooltip language (per your D4 spec)
- Update `useEffect` to respect user input rather than overwriting

## Phase 4 still pending

- DB backfill migration (planning-status schools with retention=100 → 92, null `advisory_cache` + advisory_data_hash for all schools)
- In-app banner for authorized/exported schools
- ESWA communication draft
- BACKLOG.md + spec updates

## STOP — Phase 2 complete

Awaiting Travis greenlight on Phase 3 (UI: F1 fix + slider + onboarding control).
