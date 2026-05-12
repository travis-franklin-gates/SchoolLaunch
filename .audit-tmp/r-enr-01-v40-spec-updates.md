# v4.0 Spec Update Notes — R-ENR-01

**Status:** Notes for next spec revision. Travis will fold these into v4.1 (or interim revision) — DO NOT edit the spec file directly from this audit.

**Date:** 2026-05-11
**Triggered by:** R-ENR-01 paired fix (F1 + F2 + F3) shipped 2026-05-11.

---

## Section 9.2 — Revenue model (or wherever enrollment is documented)

Document enrollment retention as a configurable per-school assumption.

**Suggested addition:**

> ### Multi-year enrollment retention
>
> Multi-year enrollment projections (Year 2 onward) apply an annual retention rate to continuing-grade students. New-grade-level students enroll at full planned capacity each year and are not subject to retention.
>
> **Default:** 92%, calibrated against WA charter elementary observed retention (typical range 90–95%).
> **Adjustable range:** 70%–100% in 1% increments via the slider in Settings → Grade Expansion (also available during onboarding Step 2).
> **Stored at:** `school_profiles.retention_rate` (top-level numeric column, integer percentage).
>
> Formula (whole-year compounding):
> - **Year 1 (founding):** Total = planned capacity. Returning = 0.
> - **Year n ≥ 2:** Returning = round(Year n-1 total × retention_rate / 100). Total = Returning + new-grade-level students.
>
> Retention is applied to the school as a whole, not per-grade. Grade promotion is not explicitly modeled — retention is a school-wide aggregate carryover factor.
>
> Once a school reaches full buildout, total enrollment may decline year-over-year if retention < 100% (no new grade additions to offset attrition). This is intentional and reflects realistic stable-state enrollment.

---

## Section 12.4 — Recently resolved

**Suggested entry:**

> ### R-ENR-01 — Multi-year retention modeling (2026-05-11)
>
> Three compounding bugs discovered during the Evergreen Heights baseline audit, fixed as a single paired release:
>
> **F1 (UI):** `GradeExpansionEditor` hardcoded `retentionRate = 100`, ignored its `initialRetentionRate` prop, and pushed 100 to the parent on every render. No user-facing control existed for adjusting retention.
>
> **F2 (engine, critical):** `computeExpansionEnrollments` accepted a `retentionRate` parameter but never used it. Multi-year projections silently assumed 100% retention regardless of what value was stored in `school_profiles.retention_rate`. Same dead-parameter pattern in `expansionToEnrollmentArray`.
>
> **F3 (AI advisory):** Context strings generated for advisory agents described attrition modeling ("X% retention with Y% backfilled through new student recruitment") that didn't exist in the underlying calculations. Agents were reasoning about a model the engine didn't implement.
>
> **Fix:** Engine now applies Formula A whole-year compounding retention. UI exposes a slider (range 70–100%, default 92%) with tooltip explaining the assumption and the buildout-decline behavior. AI prose rewritten to accurately describe the engine. DB backfill migrated 16 planning-status schools from retention=100 to retention=92; 12 advisory caches cleared so agents re-run with corrected context. Zero authorized/exported schools at fix time, so no submitted Commission plan was affected.
>
> **Regression test:** `tests/session4/grade-expansion.spec.ts` — 13 new test cases pinning the math and invariants. 18/18 passing.
>
> **Phase artifacts:** `.audit-tmp/r-enr-01-phase1.md`, `phase2.md`, `phase3.md`.

---

## Section 14.1 — Architecture principles

### Correction needed: advisory cache clear pattern

**Current spec text (incorrect):**
> Advisory cache clear: `UPDATE school_profiles SET advisory_cache = NULL, advisory_data_hash = NULL`

**Corrected text:**
> Advisory cache clear: `UPDATE school_profiles SET advisory_cache = NULL`. The `AdvisoryCache` JSONB blob contains `dataHash` as an internal property (see `types.ts:152-165` `AdvisoryCache` interface), so a single `advisory_cache = NULL` atomically clears both the cache and its hash. There is no separate `advisory_data_hash` column.
>
> The related column `scenarios.base_data_hash` does exist on the `scenarios` table — that's the scenario-staleness-detector hash, a different concern.

---

### Suggested new principle: dead parameters are a code smell

**Suggested addition to architecture principles list:**

> ### Dead parameters are a code smell
>
> If a function accepts a parameter that the function body never references, that parameter is a lie about the function's contract. Upstream callers will plumb data into it expecting it to affect behavior; AI assistants will assume the parameter is wired up.
>
> **Canonical example (R-ENR-01):** `computeExpansionEnrollments(plan, retentionRate)` accepted `retentionRate` in its signature with a default value, but the function body never referenced it. Five upstream readers passed `profile.retention_rate ?? 90` into the dead receiver. The bug went undetected for months because the immediate sibling function (`defaultYearNewGrades`) had comprehensive unit tests, while the actual math-bearing function had zero direct test coverage.
>
> **Practice:**
> 1. When reviewing a function, scan its body for every named parameter. If the body doesn't use the parameter, either remove the parameter or use it.
> 2. Linters (ESLint `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"`) catch the trivial case but miss parameters that are renamed, destructured, or passed through to helpers that also don't use them.
> 3. For functions with arithmetic or critical semantics, require direct unit tests at the function — not just at the surrounding orchestration. The "test the sibling" pattern is fragile.

---

## Section 9.3 — SSE clarification

**Triggered by:** Part 3 audit finding F-005, 2026-05-11.

**Add this clarification to the SSE section of the spec:**

> SSE fires when AAFTE is BELOW prototypical minimum thresholds (60 for K-6, 20 for 7-8, 60 for 9-12), NOT at or above. The current spec language is correct ("displays $0 when not applicable") but the audit prompt phrasing inverted this. Reaffirm threshold direction in spec to prevent future audit-prompt errors.

**Context:** The Evergreen Heights baseline audit prompt asserted "SSE should fire and be visible" for a school at 68 AAFTE in the K-6 band (60 minimum). The implementation correctly returned $0 because the school exceeds the minimum. The audit prompt language was inverted — the spec assertion needs explicit reaffirmation so future audit-template authors don't make the same inversion.

**Severity:** Spec-only correction. Implementation is correct (Revenue tab shows `$0` with formula explanation "All grade bands exceed minimums"). No code change.

---

## Section reference: this file

`.audit-tmp/r-enr-01-v40-spec-updates.md` — these notes — should be deleted (or moved to an archive) once folded into the next spec revision.
