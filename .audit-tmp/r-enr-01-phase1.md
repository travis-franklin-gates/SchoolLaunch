# R-ENR-01 — Phase 1 Diagnosis Report

**Date:** 2026-05-11
**Audit context:** Discovered during Evergreen Heights baseline audit (Part 2 checkpoint).
**Status:** Phase 1 complete. Awaiting Travis greenlight on default-value, backfill-rule, and onboarding-control decisions before Phase 2.

---

## Executive summary

R-ENR-01 is two paired bugs:

- **F1 (HIGH, UX):** `GradeExpansionEditor.tsx:64` hardcodes `const retentionRate = 100`. The `initialRetentionRate` prop is destructured (line 38) but never consumed. The useEffect at 196–204 pushes `retentionRate: 100` to the parent on every render, which then writes 100 to the DB. No user-facing UI exists to set retention ≠ 100%.

- **F2 (CRITICAL, engine + AI):** `gradeExpansion.ts:180-205` `computeExpansionEnrollments` accepts `retentionRate` but never references it in the function body. Comment on line 194 confirms: *"Total = full planned capacity"*. Same dead-parameter pattern in `expansionToEnrollmentArray:227-245`. Five upstream readers (budgetEngine, buildSchoolContext, staffing/page, staffing/seed, StepEnrollment) plumb `retention_rate` through to these dead readers. **No multi-year projection has ever modeled attrition.**

A third sub-finding emerged during the grep:

- **F3 (HIGH, AI advisory):** `buildSchoolContext.ts:213, 375` generates AI agent context with prose like `"Grade expansion with 90% cohort retention (10% annual attrition backfilled through new student recruitment)"` while the accompanying enrollment numbers reflect zero attrition. **AI agents have been receiving structurally false framing of how the engine works.** Any advisory output sent to schools or the Commission may have been reasoning against a model that doesn't exist.

F1 + F2 + F3 ship together as R-ENR-01.

---

## 1.1 Full caller-site grep

38 hits across src/ and tests/. Classified below:

### Writers (set the value)

| File:Line | Action | Notes |
|---|---|---|
| `onboarding/page.tsx:119` | initial state `retentionRate: 100` | Hard-coded default for new onboarding sessions |
| `onboarding/page.tsx:237` | `retentionRate: profile?.retention_rate ?? prev.retentionRate` | Load-from-DB restore |
| `onboarding/page.tsx:353` | `retentionRate: stepData.retentionRate ?? prev.retentionRate` | Merge step output into wizard state |
| `onboarding/page.tsx:377` | `profileUpdate.retention_rate = stepData.retentionRate` | **DB WRITER** (onboarding completion) |
| `settings/page.tsx:152` | `profileUpdate.retention_rate = expansionData.retentionRate` | **DB WRITER** (Settings save) |
| `GradeExpansionEditor.tsx:200-204` | `onChange({ retentionRate, ... })` in useEffect | Pushes hardcoded 100 to parent on every render → overwrites DB via Settings/Onboarding save paths |

### Passthroughs (accept and forward — and the chain is broken at the end)

| File:Line | Pattern | Notes |
|---|---|---|
| `GradeExpansionEditor.tsx:38` | `initialRetentionRate` destructured | **PROP NEVER USED** |
| `GradeExpansionEditor.tsx:64` | `const retentionRate = 100` | **HARDCODED CONST — F1 root** |
| `GradeExpansionEditor.tsx:159` | `computeExpansionEnrollments(plan, retentionRate)` | Passes to dead function |
| `StepEnrollment.tsx:59, 91, 99` | Type declarations | Interface plumbing |
| `StepEnrollment.tsx:154, 166` | `expansionToEnrollmentArray(plan, expansionResult.retentionRate)` | Onboarding's enrollment compute → dead function |

### Readers that feed the dead engine

| File:Line | Action | Notes |
|---|---|---|
| `budgetEngine.ts:494, 496, 499` | `const retentionRate = profile.retention_rate ?? 90` then passes to expansion fns | **DEAD CHAIN — primary engine path** |
| `budgetEngine.ts:1076, 1078, 1081` | Same pattern, second caller | DEAD CHAIN |
| `staffing/page.tsx:285` | `expansionToEnrollmentArray(plan, profile.retention_rate ?? 90)` | Staffing FTE for per-pupil-driven positions reads enrollment from dead function |
| `staffing/seed/route.ts:107-108` | Same pattern, seeding API | DEAD CHAIN |

### Readers that consume but only for prose / hash

| File:Line | Action | Notes |
|---|---|---|
| `buildSchoolContext.ts:114` | `retention: profile.retention_rate ?? null` in hash input | **HASH READER** — drives advisory cache invalidation only |
| `buildSchoolContext.ts:206` | `const retRate = profile.retention_rate ?? 90` | Reads for prose |
| `buildSchoolContext.ts:209` | `computeExpansionEnrollments(plan, retRate)` | Numbers come back unaffected |
| `buildSchoolContext.ts:213` | **Prose: `"Growth model: Grade expansion with ${retRate}% cohort retention..."`** | **F3 — prose ≠ numbers** |
| `buildSchoolContext.ts:365, 369, 370` | Same pattern, second context builder | F3 second site |
| `buildSchoolContext.ts:375-379` | **Prose: `"ENROLLMENT (Grade Expansion Model, ${retRate}% retention):"`** | F3 second site |
| `buildSchoolContext.ts:373` | Prose includes `"returning: ${e.returning}"` field | **`returning` field is misleadingly named** — it's `total - newGradeStudents`, NOT retention-adjusted |

### The dead readers themselves

| File:Line | Function | Notes |
|---|---|---|
| `gradeExpansion.ts:180-205` | `computeExpansionEnrollments(plan, retentionRate = 90)` | **DEAD — F2 primary root** |
| `gradeExpansion.ts:227-245` | `expansionToEnrollmentArray(plan, retentionRate = 90)` | **DEAD — F2 secondary** (delegates to dead primary) |

### Type / interface declarations

| File:Line | What |
|---|---|
| `types.ts:145` | `retention_rate?: number \| null` on `SchoolProfile` interface |
| `settings/page.tsx:63, 71`, `GradeExpansionEditor.tsx:27`, `onboarding/page.tsx:86, 342, 767`, `StepEnrollment.tsx:59` | Various interface/prop shapes for the wizard state |

### Test fixtures

| File:Line | Pattern | Concern |
|---|---|---|
| `advisory-hash.spec.ts:39` | `retention_rate: 0.9` | **Decimal form** — production reads percentage |
| `advisory-hash.spec.ts:162` | `retention_rate = 0.85` | Decimal again |

**Sub-issue:** test fixtures use 0.9/0.85 (fractional), production code reads 90/100 (percentage). Hash test is a-OK (only cares about value changing), but anyone copy-pasting the fixture as a starting point would silently write a 0.9% retention to the DB. Code-hygiene flag, not a Phase 2 blocker.

---

## 1.2 Default value research

### Existing schools' current `retention_rate` values

Snapshot of `school_profiles.retention_rate` across all 23 schools currently in the DB (all `status = planning`):

| retention_rate | Count |
|---|---|
| 100 | 14 |
| 90 | 9 |

The 90s are likely schools created via test/seed scripts that explicitly set 90 (since the only UI path for users writes 100). The 100s are organic onboarding outputs.

Spot-check on schools Travis mentioned:

| School | Status | retention_rate | Y1 → Y5 |
|---|---|---|---|
| Columbia Valley Charter | planning | 100 | 72 → 168 |
| Evergreen Heights (this audit) | planning | 90 (patched mid-audit) | 72 → 144 |
| Spokane Academy | planning | 100 | 24 → 120 |
| Spokane Arts Academy | planning | 90 | null → 0 (incomplete fixture) |
| Spokane Music | planning | 100 | 48 → 240 |
| Cascade Charter Elementary | planning | 90 | — |
| Cedar Grove (Public Schools) | planning | 100 | — |

No school named "Cedar Ridge" — the audit phase tests in `tests/audit/phase-*` may be school-agnostic. They don't reference retention by name (`grep -i "retention\|cedar"` in `tests/audit/` returned no matches).

### Empirical retention reference points (general — not from internal data)

For founder-facing defaulting, these are reasonable anchors:
- **WA charter elementary (K-5):** 85-92% typical
- **WA charter middle (6-8):** 80-88% typical
- **WA charter high (9-12):** 75-85% typical
- **Mature elementary (Y5+):** 90-95% if school is well-established

The current engine fallback is 90% (`profile.retention_rate ?? 90` across all readers). That's a reasonable single value if grade-band differentiation is deferred.

### Decision options (need Travis input)

**Option A — Single default, slider for adjustment (lowest scope, recommended for May 19)**
- New default: 90% for all grade bands
- Slider range: 70–100%, step 1
- Tooltip explains grade-band realism range
- Founders adjust manually if their model needs it

**Option B — Grade-band-aware default**
- Default lookup table: elementary 90, MS 85, HS 80
- Engine computes weighted average based on grade mix in plan
- Slider adjusts the *weighted average*, with secondary controls for band-specific overrides
- More accurate but adds schema complexity (`retention_rate_by_band` JSONB?) and UI complexity

**Option C — Status-quo + slider (no default change)**
- Keep default 90% but expose the slider so founders see and confirm the assumption explicitly
- Cheapest implementation; founders make the call
- Risk: founders accept the default without thinking about it, same as today

**Recommendation:** Option A for R-ENR-01. Reserve Option B for a v4.1 enhancement once attrition modeling has a baseline.

**Open questions for Travis:**
1. Default value for the slider's initial position — 90? 88? 92?
2. Slider min: 70 reasonable, or do we want 60 to allow stress-test modeling?
3. Slider max: 100 (some founders genuinely model no attrition for waitlist-deep elementary contexts) or cap at 98 to force at least nominal attrition?
4. Onboarding placement: silent default, end-of-Step-2 reveal, or new dedicated Step?

---

## 1.3 Backfill rule

### `schools.status` actual constraint

`CHECK constraint schools_status_check`: status ∈ `{ 'planning', 'authorized', 'exported' }`.

**Travis's R-ENR-01 prompt referenced `submitted` and `under_review` — these don't exist in the schema.** The actual values are:
- `planning` — pre-submission (the only value currently in the DB)
- `authorized` — post-Commission approval
- `exported` — exported to SchoolCFO (post-authorization, ongoing operation)

### Proposed backfill rule

```sql
-- Phase 4 migration — DO NOT RUN UNTIL R-ENR-01 PHASE 2+3 SHIP

-- 1. Schools in planning status (auto-update to new default)
-- WARNING: This invalidates advisory_cache for every affected school
UPDATE school_profiles sp
SET retention_rate = 90,
    advisory_cache = NULL  -- force re-run with new context
FROM schools s
WHERE sp.school_id = s.id
  AND s.status = 'planning'
  AND sp.retention_rate = 100;  -- only update where the unfixed UI overwrote

-- 2. Schools in authorized or exported status: preserve historical model
-- These have already been Commission-reviewed against the 100%-retention model;
-- changing values silently would corrupt audit trail.
-- Recommendation: leave retention_rate as-is, surface an in-app banner.

-- (No SQL change for #2; banner logic lives in app code.)
```

**Decision points for Travis:**
1. Should the backfill also update schools currently at `retention_rate = 90` (the seed-script schools)? Probably no — they were explicitly set.
2. Should `advisory_cache = NULL` cascade trigger be part of the migration, or should I trust the existing hash-based cache invalidation to handle it?
3. For `authorized`/`exported` schools: in-app banner only, or also email notification?

### Affected row estimate (planning, retention=100)

Based on current DB (23 schools, all planning):
- 14 schools at retention=100 → would auto-update
- 9 schools at retention=90 → no change
- 0 schools at retention NULL → would default at engine read time

This is dev DB. Production may have a different distribution. Run a SELECT-only count before the UPDATE in production.

---

## 1.4 Regression surface map

Every screen and export that consumes enrollment numbers downstream of `computeExpansionEnrollments`. Post-fix expected deltas for Evergreen Heights' specific plan (K-2 founding, K-5 buildout, 1×24 sections):

### Pre-fix vs post-fix enrollment trajectory (Evergreen Heights, retention=90)

| Year | Current (retention ignored) | Post-fix (retention=90%) | Delta |
|---|---|---|---|
| 1 | 72 | 72 | 0 (no prior year) |
| 2 | 96 | 0.9×72 + 24 new = 88 | -8 (-8%) |
| 3 | 120 | 0.9×88 + 24 = 103 | -17 (-14%) |
| 4 | 144 | 0.9×103 + 24 = 117 | -27 (-19%) |
| 5 | 144 | 0.9×117 + 0 = 105 | -39 (-27%) |

*(Math is illustrative — actual formula needs Travis approval in Phase 2. The "retention applies to continuing students only, not new-grade students" rule is critical to get right.)*

### Affected surfaces

| Surface | Specific numbers that change | Severity of visual change |
|---|---|---|
| **Overview health tiles** | Reserve Days (operating expenses adjust), Personnel % (denominator shifts), Break-Even Enrollment (depends on Y1 only, unchanged) | MEDIUM — at least one tile color likely shifts |
| **Revenue tab Y2–5** | Every revenue line scales with enrollment (Regular Ed, SSE if applicable, all categoricals × FRL/IEP/ELL percentages × enrollment) | HIGH — every year column changes |
| **Staffing tab Y2–5** | Per-pupil-driver FTE recomputes from new enrollment (teacher_elem, paraeducator, custodian, food_service, etc.) | HIGH — Year 5 FTE may drop by 1-2 |
| **Cash Flow Y1** | Unchanged (no prior year to retain from) | NONE |
| **Cash Flow Y2+** | Only if a multi-year cash flow exists; current scope is Y1 monthly | LOW (unless multi-year cash exists) |
| **Multi-Year tab** | Every year column from Y2 forward — Revenue, Personnel, Operations (some are per-student), Net, Beginning Cash, Ending Cash, Reserve Days | HIGH — the most visible change |
| **FPF Scorecard** | Enrollment Variance, Total Margin (revenue ÷ expenses), Days Cash on Hand (depends on operating expenses) | HIGH — Stage 2 thresholds may go from green to red on any school running near the edge |
| **Scenarios** | Conservative/Base/Optimistic recompute. Conservative is most affected (further enrollment reduction compounds) | HIGH — all three scenarios shift |
| **Advisory Panel (7 agents)** | Commission Reviewer, Enrollment Realist, Staffing Advisor most affected. Context prose now matches numbers (fixes F3). | HIGH — agent recommendations may flip |
| **Ask SchoolLaunch** | Answers about enrollment, multi-year projections, FPF compliance change | HIGH |
| **Budget Narrative PDF** | Executive Summary, Multi-Year Projections, Revenue Analysis, Staffing Plan, Cash Flow narratives, FPF Scorecard, AI advisory sections — all shift | CRITICAL for any PDF generated post-fix |
| **Commission V8 Excel** | Revenue tab (per-year columns), Staffing tab (per-year FTE), P&L tab, Cash Flow tab, Dashboard tab, Scenarios tab, FPF Matrix tab | CRITICAL for any Excel generated post-fix |
| **Portfolio Dashboard cards** | Year 1 reserve days unchanged; if Y2+ metrics surface (Reserve Days trend), they shift | LOW–MEDIUM |
| **AI briefing (Overview)** | Briefing regenerates with new context. Prose finally matches numbers. | MEDIUM |
| **Alignment Review** | If review references multi-year, it shifts. Y1 unchanged. | LOW |

### Cache invalidation requirement

`buildSchoolContext.ts:114` includes `retention_rate` in the hash input, so changing the value invalidates `advisory_cache` automatically. But the actual numbers passed to agents change post-fix even at the SAME `retention_rate` value because the function now uses it. Hash invalidation is necessary AND sufficient when retention_rate changes; for the F2 fix-without-retention-change, we need to explicitly bump `PROMPT_VERSION` or null out `advisory_cache` on all schools as part of the Phase 4 backfill.

---

## 1.5 Existing test coverage check

### Direct unit tests for the dead functions

| Function | Direct test coverage |
|---|---|
| `computeExpansionEnrollments` | **NONE** |
| `expansionToEnrollmentArray` | **NONE** |
| `defaultYearNewGrades` | `tests/session4/grade-expansion.spec.ts` — 5 test cases, well covered |

The bug went undetected because the canonical sibling function (`defaultYearNewGrades`) is well-tested, while the math-bearing functions immediately downstream have zero direct coverage. This is exactly the "test what's near it, not what matters" anti-pattern.

### E2E / integration tests touching enrollment math

| Test | Touches retention? | Notes |
|---|---|---|
| `tests/session4/advisory-hash.spec.ts` | Yes — uses retention_rate as one of many hash inputs | Only checks hash sensitivity, not enrollment math |
| `tests/session4/revenue-integrity.spec.ts` | Indirectly — revenue scales with enrollment | Tests SSE constituent sum, not retention |
| `tests/session4/e2e/full-founder-journey.spec.ts` | Likely — full journey hits Y2–5 enrollment | Not inspected in this phase; likely passes today because the buggy numbers are deterministic |
| `tests/audit/phase-*/spec.ts` (Phases 1–7) | No direct retention reference | Tests UI rendering / counts, not enrollment math |

### Cedar Ridge regression baseline

Travis referenced "Cedar Ridge Academy Playwright smoke test (Phases 1–7 currently green)" — no school named "Cedar Ridge" exists in the DB. Closest names: "Cedar Grove" (status: planning, retention: 100), "Cedar Grove Public Schools" (two rows, both planning, retention: 100). The audit phase tests are school-agnostic, not Cedar-specific.

**Question for Travis:** is "Cedar Ridge" a renamed school, a not-yet-onboarded school, or a placeholder name from a prior audit document? The Phase 5 verification step references it as the regression baseline.

### Coverage gaps to fill in Phase 2.4 (regression tests for R-ENR-01)

New tests needed:
1. **`computeExpansionEnrollments` unit test (3 retention values):**
   - retention=100 → legacy trajectory `[72, 96, 120, 144, 144]` (regression guard for current behavior)
   - retention=90 → trajectory with attrition (specific numbers TBD per Phase 2 math)
   - retention=0 → trajectory equal to cumulative new-grade additions only
2. **`expansionToEnrollmentArray` unit test:** delegates correctly to `computeExpansionEnrollments`
3. **Constituent-sum invariant:** for any retention r, `total[N] == returning[N] + newGrade[N]` and `returning[N] == round(continuing_prior[N-1] × r/100)`
4. **Cross-pathway isolation test:** verify Generic pathway enrollment math is unchanged (don't accidentally break that pathway)
5. **AI context coherence test:** verify the prose at `buildSchoolContext.ts:213` numerically matches the `enrollSummary` numbers (catches F3 regressions)

---

## Architectural decisions surfaced for Phase 2

Before writing code, Travis needs to approve:

### D1 — Retention math formula
Two reasonable formulations:

**Formula A (recommended):** retention applies to continuing-grade students only.
- `returning[N] = round(sum_of_continuing_grade_students[N-1] × r/100)`
- `total[N] = returning[N] + sum(new_grade_students[N])`
- New-grade students are not subject to retention (they're new arrivals)

**Formula B:** retention applies to all prior-year students.
- `total[N] = round(total[N-1] × r/100) + new_grade_students[N]`
- Less accurate — penalizes new-grade additions retroactively
- Not recommended

### D2 — Slider default (Phase 1.2 above)
Pick a number: 88, 90, 92, or other.

### D3 — Slider range (Phase 1.2 above)
70–100 vs 60–100 vs 70–98.

### D4 — Onboarding control
Three options:
- Silent default (cheapest)
- Reveal in Step 2 enrollment summary ("Multi-year projections assume X% annual retention")
- Editable slider in Step 2 (most explicit)

### D5 — Backfill scope
- Auto-update only schools at exactly retention_rate=100? Or include retention_rate=null (no value set)?
- Include retention_rate=90 from seed scripts? (Probably no — they were explicit.)
- Null-out `advisory_cache` for all affected schools? Or rely on hash change?
- Banner for `authorized` / `exported` schools? Or email only? Or both?

### D6 — `submitted` / `under_review` status values
R-ENR-01 prompt assumed these exist; they don't. The schema has `planning`, `authorized`, `exported`. Travis's prompt language for backfill (`submitted`/`under_review`) needs to be reconciled — either add the missing statuses to the schema, or treat `authorized` as the "preserve historical" trigger.

### D7 — Scope guardrail
The user prompt explicitly says: **don't expand R-ENR-01 to absorb related findings.** F3 (AI context prose lies) is being included because it's the same root cause as F2 — it's not scope expansion, it's same-bug-different-surface. Other potentially related issues (e.g., AAFTE realism — see `advisory/route.ts:73`, which discusses 88-92% Y1 AAFTE for new schools) are out of scope and go in `r-enr-01-related-findings.md` if surfaced.

---

## Recommendations before Phase 2

1. **Approve Formula A** for retention math (or specify Formula B if preferred).
2. **Pick the default value** (90 unless you want different).
3. **Pick slider range** (70–100 recommended).
4. **Choose onboarding placement** (silent default vs reveal vs editable).
5. **Confirm Evergreen Heights as the dev-loop verification school** for Phase 2.5 (currently patched to retention=90).
6. **Clarify Cedar Ridge** — does it refer to an existing school, or is it the audit-phase test naming?
7. **Reconcile status values** — schema has planning/authorized/exported, not submitted/under_review.

---

## Files written by Phase 1

- `.audit-tmp/r-enr-01-phase1.md` — this file
- `.audit-tmp/r-enr-01-related-findings.md` — to be created if any non-retention findings surface in Phase 2+

## STOP — Phase 1 complete

Awaiting Travis greenlight on D1–D7 above before starting Phase 2 (engine fix).
