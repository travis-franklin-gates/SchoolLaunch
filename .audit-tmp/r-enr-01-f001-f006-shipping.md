# Shipping Report — R-ENR-01 + F-001/F-011 + F-006

**Date:** 2026-05-11
**Author:** Claude Code (Sonnet 4.6)
**Status:** Ready for Travis review → commit → push
**Constraints:** No git operations performed. Travis handles commit + push manually.

---

## Headline

Three compounding fixes shipped in one audit cycle:
1. **R-ENR-01** — multi-year retention modeling (F1 + F2 + F3 paired fix)
2. **F-001 / F-011** — Personnel % threshold inconsistency across 4 surfaces (1 centralized helper)
3. **F-006** — Operating Revenue vs Total Revenue semantic conflation (1 line + UI reorder)

Every verification gate passed. R-ENR-01 was discovered during the Evergreen Heights baseline audit Part 2 and corrected before Part 3 resumed. F-001/F-011 and F-006 surfaced during Part 3 and were Phase-1 → Phase-2 corrected after greenlight. The Evergreen Heights audit baseline now reflects post-fix state and is the verification anchor for all three fixes.

---

## Fixes summary

### R-ENR-01 — Multi-year retention modeling

**Three compounding bugs:**
- **F1 (UI):** `GradeExpansionEditor.tsx:64` hardcoded `const retentionRate = 100`, ignored `initialRetentionRate` prop, useEffect overwrote DB on render
- **F2 (engine, critical):** `computeExpansionEnrollments` accepted `retentionRate` parameter but never used it. Same dead-parameter pattern in `expansionToEnrollmentArray`. 5 upstream readers plumbed `retention_rate` through to dead receivers.
- **F3 (AI advisory):** `buildSchoolContext.ts` generated prose claiming attrition modeling that the engine didn't implement (`"X% retention with Y% attrition backfilled through new student recruitment"`)

**Fix:** Formula A whole-year compounding retention. `RETENTION_RATE_DEFAULT = 92` calibrated against WA charter elementary 90-95% norms. `useState(initialRetentionRate ?? 92)` in editor with slider UI (range 70-100%, step 1). AI prose rewritten to accurately describe the engine.

**DB backfill:** 16 planning-status schools migrated retention=100 → 92. 12 advisory_caches cleared. Migration recorded in `supabase/migrations/20260511220000_r_enr_01_backfill_retention_default.sql` for schema sync.

### F-001 / F-011 — Personnel % threshold inconsistency

**Bug:** Six independent hardcoded copies of "72-78%" threshold across Overview tile, Staffing tab UI, Staffing Advisor prompt, Ask SchoolLaunch prompt, PDF export, and dev showcase. Year-of-operation context missing — founding-year schools (65-72% healthy per audit C-decision) flagged as "below healthy" while AI briefing said "sustainable".

**Fix:** Single source of truth at `src/lib/healthThresholds.ts` with `evaluatePersonnelPctHealth(pct, year)`. Two-band model (founding Y1: 65-72%; steady-state Y2+: 72-78%) with symmetric ±3pt approaching bands. All 6 consumers refactored. AI prompts dynamically inject `personnelHealthBandsForPrompt()` so the prose never drifts from the verdict logic.

### F-006 — Operating Revenue / Total Revenue semantic split

**Bug:** Two `operatingRevenue` variables with conflicting semantics:
- `computeSummaryFromProjections` (line 167): `operatingRevenue = rev.total` (excludes Interest)
- `computeMultiYearDetailed` (line 553): `operatingRevenue = rev.total + interestIncome` (includes Interest)

Surfaces consuming each function showed different Y1 Operating Revenue ($1,076,886 vs $1,080,636). Internal inconsistency on the Overview page itself.

**Fix:** One-line change at `budgetEngine.ts:553`: `const operatingRevenue = rev.total`, with `totalRevenue = operatingRevenue + interestIncome + grantRevenue`. Multi-Year UI reordered to show Operating Revenue above Interest with tooltip "Earned from school operations. Interest income and grants reported separately below."

**Trip-wire check:** All 45 FPF cells (9 metrics × 5 years) for Evergreen unchanged in verdict post-fix. Analytical bound favors positive-net schools (post-fix Total Margin trends more positive). No schools in current DB sit in the negative-margin trip-wire window.

---

## Files changed (this session)

### Created
- `src/lib/healthThresholds.ts` — F-001/F-011 SSOT helper
- `tests/session4/grade-expansion.spec.ts` extension — 13 new R-ENR-01 retention tests
- `tests/session4/health-thresholds.spec.ts` — 26 F-001/F-011 boundary tests
- `tests/session4/revenue-classification.spec.ts` — 7 F-006 invariant tests
- `supabase/migrations/20260511220000_r_enr_01_backfill_retention_default.sql` — R-ENR-01 backfill (already applied via MCP)

### Modified — R-ENR-01
- `src/lib/gradeExpansion.ts` — Formula A engine, `RETENTION_RATE_DEFAULT = 92`, `getRetentionRate()`, fix-fill-forward bug
- `src/lib/budgetEngine.ts` — `getRetentionRate` accessor adoption at 2 call sites
- `src/lib/buildSchoolContext.ts` — F3 prose corrected at 2 prompt sites + buildout-decline addendum
- `src/app/(authenticated)/dashboard/staffing/page.tsx` — accessor adoption
- `src/app/api/staffing/seed/route.ts` — accessor adoption
- `src/app/(authenticated)/dashboard/multiyear/page.tsx` — Y1 New Grade Students copy → "—"
- `src/components/GradeExpansionEditor.tsx` — F1 fix (useState + slider UI)
- `src/app/(onboarding)/onboarding/page.tsx` — initial state `RETENTION_RATE_DEFAULT`

### Modified — F-001 / F-011
- `src/app/(authenticated)/dashboard/page.tsx` — Overview tile uses helper
- `src/app/(authenticated)/dashboard/staffing/page.tsx` — UI callout uses helper
- `src/app/api/advisory/route.ts` — Staffing Advisor prompt + helper text injection
- `src/app/api/chat/route.ts` — Ask SchoolLaunch prompt + helper text injection
- `src/app/api/export/narrative/route.ts` — PDF export uses helper
- `src/app/dev/components/Showcase.tsx` — FIXME comment per D7

### Modified — F-006
- `src/lib/budgetEngine.ts` — line 553 semantic fix + comment block
- `src/app/(authenticated)/dashboard/multiyear/page.tsx` — TotalRow tooltip prop, row reorder, Tooltip import

### Modified — Documentation
- `BACKLOG.md` — R-ENR-01 RESOLVED entry + RF-1 through RF-4 logged
- `.audit-tmp/r-enr-01-phase1.md` through `phase3.md` — R-ENR-01 phase reports
- `.audit-tmp/r-enr-01-related-findings.md` — RF-1..4 + Phase 5 verification gates
- `.audit-tmp/r-enr-01-v40-spec-updates.md` — Section 9.3 SSE clarification per Travis's exact wording (6th section)
- `.audit-tmp/eswa-r-enr-01-notice.md` — ESWA communication draft
- `.audit-tmp/f-001-f-011-phase1.md` and `phase2.md` — F-001 phase reports
- `.audit-tmp/f-006-phase1.md` and `phase2.md` — F-006 phase reports
- `.audit-tmp/part2-baseline-snapshot.md`, `part3-findings.md` — audit detail
- `audit-reports/baseline-evergreen-2026-05-11.md` — final audit findings report

### Screenshots — 26 captured
`audit-01-signup-filled.png` through `audit-26-f006-fixed-multiyear.png` documenting onboarding, baseline audit, R-ENR-01 phases, F-001 4-surface alignment, F-006 Multi-Year reorder.

---

## Verification gates — all passed

### Unit tests: 51/51 pass

```
npx playwright test tests/session4/grade-expansion.spec.ts tests/session4/health-thresholds.spec.ts tests/session4/revenue-classification.spec.ts
51 passed (~2s)
```

- 18 R-ENR-01 retention math
- 26 F-001/F-011 personnel-% thresholds
- 7 F-006 revenue classification

### F-001/F-011 4-surface alignment

All 4 surfaces now agree 65.3% Y1 personnel is healthy founding-year:
1. Overview tile: "Meets, teal, Within founding-year range"
2. Overview AI Briefing: "meets all Stage 1 standards"
3. Staffing Advisor agent: *"falls within the healthy founding-year band (65-72%)"*
4. Ask SchoolLaunch: *"right in the middle of the healthy range for Year 1 schools (65-72%) ✓ MEETS STANDARD"*

Zero regression of "below the healthy 72-78%" language across AI output.

### F-006 cross-cutting byte verification

All 5 Operating Revenue surfaces display $1,076,886 byte-for-byte:
- Revenue tab ✓
- Multi-Year tab ✓ (was $1,080,636, NOW FIXED)
- Overview Y1 Base Case ✓ (was $1,080,636, NOW FIXED)
- Personnel % tile denominator ✓ (was already correct via different code path)
- AI agent context ✓ (was already correct)

### Total Margin trip-wire — Evergreen no flips

45/45 FPF cells unchanged. Travis explicit instruction to STOP if any cell flips was honored — none did.

### Cache invalidation — verified end-to-end

- R-ENR-01 P4.1 migration cleared 12 caches; agents regenerated on first visit with new prose
- F-001/F-011 P2.4 cleared cache for cache-populated schools (Evergreen + 1 other); agents regenerated with year-aware bands
- F-006 closeout cleared cache (1 school: Evergreen, the only one repopulated this session); agents will regenerate on next visit with corrected Operating Revenue context

### DB state post-shipping

| Status | retention_rate | Schools | advisory_cache |
|---|---|---|---|
| planning | 92 | 17 | NULL |
| planning | 90 | 6 | NULL |
| authorized + exported | — | 0 | — |
| Orphan (no school_profiles) | — | 1 | — (RF-1 follow-up) |

Evergreen Heights audit school: `retention_rate=92`, `advisory_cache=NULL` (regenerates on next visit).

---

## Known issues NOT addressed

### Cedar Ridge E2E smoke test (Phase 1 selector mismatch)

`tests/session4/e2e/full-founder-journey.spec.ts:178` uses `#fullName` selector, but the signup page was refactored to `<FormField>` (which generates IDs via React's `useId()` → `:r0:` style). The test breaks at Phase 1 signup. **This is a pre-existing test-infra issue, NOT caused by R-ENR-01 / F-001 / F-006 changes** — none of my fixes touched signup or FormField. Logging as a follow-up to existing BACKLOG entry S4-04 (Cedar Ridge E2E — Phase 8+ findings); now also affecting Phase 1.

### Generic-pathway retention + threshold logic

`computeGenericProjections` (budgetEngine.ts:1100+) has the same dead-parameter pattern for retention_rate that R-ENR-01 fixed for WA pathway. Generic Personnel % thresholds also need the helper pattern. Out of scope per WA-only constraints. Backlog item.

### R-HEALTH-01 — extend healthThresholds.ts to all FPF metrics

F-001/F-011 fixed only Personnel %. Days of Cash, Total Margin, Current Ratio, Enrollment Variance also have distributed threshold logic. R-HEALTH-01 backlog ticket queued.

### Related findings (logged, not addressed)

- **RF-1** — Orphan `schools` row with no `school_profiles` (1 school). Triage SQL provided.
- **RF-2** — Scenarios staleness verification (Evergreen's scenarios post-fix; needs a school with pre-fix stored scenarios)
- **RF-3** — v4.0 spec doc references non-existent `advisory_data_hash` column. Spec correction queued.
- **RF-4** — R-ENR-01 in-app banner deferred (zero current authorized/exported schools). Implementation plan saved.

---

## What I did NOT do

- **No git operations.** No commits, no pushes, no branches. Travis handles all git manually.
- **No Generic-pathway changes.** WA-only scope honored throughout.
- **No backwards-compat shims.** Old retention values (90 from seed scripts, 100 pre-backfill) preserved on schools where they were explicitly set; only the silent 100 default was migrated.
- **No Cedar Ridge test fix.** Pre-existing selector issue unrelated to these fixes.

---

## Ready-to-commit checklist

Per Travis's standard practice, here's the commit-ready summary:

**Recommended commit shape (3 separate commits per the fix boundaries):**

1. `R-ENR-01: multi-year retention modeling (F1 + F2 + F3 paired fix)`
   - All R-ENR-01 phase artifacts + code changes
   - DB migration SQL file
   - 18 new tests in `grade-expansion.spec.ts`

2. `F-001/F-011: centralize personnel % thresholds across 4 surfaces`
   - `healthThresholds.ts` + 6 consumer refactors
   - 26 new tests in `health-thresholds.spec.ts`

3. `F-006: split Operating Revenue from Total Revenue (Interest excluded from operating)`
   - One-line engine change + Multi-Year UI reorder
   - 7 new tests in `revenue-classification.spec.ts`

Or a single mega-commit if you prefer one cohesive baseline-audit-correction release. Either works.

**Pre-commit checks:**
- 51/51 unit tests pass
- Browser verified end-to-end across Overview, Multi-Year, Revenue, Staffing, Ask, Advisory, Scorecard, Settings
- DB in clean state (advisory_cache nulled, retention=92 backfilled)
- Migration file in repo matches DB state
- Documentation updated (BACKLOG.md, audit-reports, .audit-tmp/)

**Post-commit follow-ups (not blocking):**
- Send ESWA notice (`.audit-tmp/eswa-r-enr-01-notice.md` — needs your edit pass)
- Fold v4.0 spec update notes into next spec revision (`.audit-tmp/r-enr-01-v40-spec-updates.md` — 6 sections)
- Triage RF-1 through RF-4
- Schedule R-HEALTH-01 (extend healthThresholds pattern)
- Fix Cedar Ridge Phase 1 selector when next touching E2E infra

---

## Constraints honored end-to-end

- ✅ WA pathway only — `computeGenericProjections` and Generic-pathway code untouched throughout
- ✅ No git operations performed
- ✅ Project ref `nlvlrznhiwuorxlapnej` verified at each migration touch point
- ✅ No scope creep — F-006 stayed Operating Revenue-only, F-001 stayed Personnel %-only, R-ENR-01 stayed enrollment retention only
- ✅ Phase-gate discipline — Phase 1 diagnosis → STOP → greenlight → Phase 2 implementation → STOP → greenlight → next fix
- ✅ Single source of truth for every centralized concept (RETENTION_RATE_DEFAULT, evaluatePersonnelPctHealth, the operatingRevenue semantic)
- ✅ F3-style coherence checks at every cache regen (no "attrition backfilled", no "below the healthy 72-78%" survives)

---

## End of report

Ready for your commit + push.
