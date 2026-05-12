# Baseline Audit — Evergreen Heights Charter Academy

**Date:** 2026-05-11
**Auditor:** Claude Code (Playwright + Supabase MCP)
**Test school:** Evergreen Heights Charter Academy (`school_id = 7d82e5d1-7943-4103-9144-a4e175da9282`)
**Pathway:** WA Charter, Yakima County (regionalization factor 1.000 — chosen to isolate from regional adjustment per the closest-to-1.00 rule)
**Audit scope:** All 12 dashboard tabs + cross-cutting checks, against post-R-ENR-01 codebase

---

## Executive Summary

- **Tabs audited:** 11 of 12 (Alignment Review skipped per audit spec)
- **New findings:** 9 (2 High, 1 Medium, 5 Low, 1 spec correction)
- **Backlog items confirmed reproducing:** 4 of 6 (P-UX-01, P-UX-02, P-UX-03, P-UX-04)
- **Headline outcome:** **R-ENR-01 (paired retention modeling fix) verified working across the full dashboard.** The audit started as baseline verification and discovered R-ENR-01 (3 compounding bugs in retention modeling) at the Part 2 checkpoint. R-ENR-01 was fixed in 4 phases (Diagnose → Engine → UI → Backfill) before the audit resumed; this report verifies the fix end-to-end and surfaces remaining baseline findings unrelated to retention.

### Pre-May-19 fix list (priority order)

1. **F-001 / F-011 — Personnel % threshold logic.** Inconsistent verdicts on the same 65.3% value across the Overview tile (red "Does Not Meet"), Overview AI Briefing ("sustainable"), Ask SchoolLaunch agent ("below healthy"), and Staffing Advisor agent ("below healthy"). Founder demos will surface this immediately. **Recommended fix:** single year-aware threshold helper `evaluatePersonnelPctHealth(pct, year, status)` consumed by the tile, the AI context builders, and any future agent prompt. Founding-year band 65–72% healthy; steady-state 72–78%. Per Travis's pre-audit C decision.
2. **F-006 — Operating Revenue mismatch.** Revenue tab Y1 = $1,076,886, Multi-Year/Overview Y1 = $1,080,636. Exact $3,750 difference = Interest & Other Income. Revenue tab doesn't include the Interest line; Multi-Year rolls it into Operating Revenue. SSOT violation. **Recommended fix:** clarify Interest classification (non-operating revenue, show as separate row below Operating).

### R-ENR-01 verification results

| Layer | Verified working |
|---|---|
| Engine (F2 fix) | Multi-Year `[72, 90, 107, 122, 112]` matches unit test exactly at retention=92 |
| UI (F1 fix) | Settings slider drag 92 → 88 → Save → DB writes → Multi-Year recalculates correctly |
| AI prose (F3 fix) | No "attrition backfilled" regression on any of 4 AI surfaces; Ask agent cites "122 × 92%" math directly |
| DB backfill | 16 schools migrated retention=100 → 92; 12 advisory_caches cleared and regenerated correctly |
| Test coverage | 18/18 grade-expansion tests pass (13 new tests for R-ENR-01) |

---

## New Findings

### F-001 — Personnel % tile flags 65.3% as "Does Not Meet" for founding-year school **(High)**

- **Severity:** High (pre-May-19 demo risk)
- **Surface:** Overview tab → Personnel % Revenue tile
- **Expected:** Founding-year (K-2, 72 students) school running at 65.3% should NOT be flagged red. Per Travis's pre-audit C decision: founding year may run 65–72%; steady state 72–78%.
- **Actual:** `<div data-testid="health-tile">` with `data-status="fails"` and red left border (`border-left-color: var(--rose-500)`).
- **Reproduction:** Open `/dashboard` for Evergreen Heights. Personnel % Revenue tile shows "Does Not Meet" with red border.
- **Suspected root cause:** Health-tile threshold is a single value (probably <72% triggers "fails"), not a year-of-operation-aware band.
- **Grep targets:** `personnel.*pct`, `healthThresholds`, the Overview health-tile component (likely `src/app/(authenticated)/dashboard/page.tsx` or `src/components/HealthTile.tsx`)
- **Screenshot:** `audit-13-p3-tab1-overview.png`

### F-002 — 5-year trajectory strip omits Year 0 **(Low)**

- **Severity:** Low (cosmetic, information preserved on Cash Flow Y0 sub-view)
- **Surface:** Overview tab → 5-year trajectory strip
- **Expected:** Per audit spec, "5-year trajectory strip shows Year 0 with no revenue and proper cash carry-forward to Year 1."
- **Actual:** Strip starts at Year 1 ("Current"). No Y0 column.
- **Decision needed:** Extend strip to include Y0, or update spec expectation. Information IS preserved (Cash Flow has a Y0 sub-view); the question is whether the at-a-glance Overview should expose Y0.
- **Screenshot:** `audit-13-p3-tab1-overview.png`

### F-003 — Scenario Summary card initially shows only Base Case **(Verify/expected behavior)**

- **Status:** Expected behavior. Evergreen had no computed scenarios pre-Build-Scenarios click. The empty-state CTA correctly showed "Build Scenarios" with no Conservative/Optimistic mentions. After clicking, all 3 scenarios seeded correctly with 5 levers.

### F-004 RESOLVED — Days of Cash Y1 tile label "Meets Stage 2" **(Low cosmetic, tile-only)**

- **Severity:** Low (cosmetic tile labeling; engine handles stages correctly)
- **Surface:** Overview tab → Days of Cash Y1 End tile
- **Expected:** Y1 evaluated against Stage 1 thresholds (≥30 days)
- **Actual:** Tile shows "Meets Stage 2" — likely showing the higher stage the value meets, not the applicable stage.
- **Verified independently correct:** Commission Reviewer agent says "meeting Stage 1 requirements in Years 1-2 and Stage 2 requirements in Years 3-5". Commission Scorecard tab shows "Meets" badge without redundant stage label. **Tile label is the only outlier.**

### F-005 — SSE spec correction **(spec defect, not code bug)**

- **Status:** Audit spec baseline assertion #5 ("SSE non-zero") had inverted understanding. SSE provides enhancement when AAFTE is BELOW the minimum, not above. Evergreen at 68 AAFTE in K-6 band (60 min) correctly returns $0.
- **Recommended action:** Update v4.0 spec assertion to reflect SSE-fires-when-below-minimum semantics.

### F-006 — Operating Revenue inconsistency Revenue tab vs Multi-Year/Overview **(Medium)**

- **Severity:** Medium (SSOT violation, ~0.35% revenue drift between two surfaces)
- **Surface:**
  - Revenue tab → Operating Revenue = **$1,076,886**
  - Multi-Year tab → Operating Revenue = **$1,080,636**
  - Overview Y1 Base Case summary → **$1,080,636**
- **Expected:** All three surfaces should show identical Y1 Operating Revenue.
- **Actual:** $3,750 difference = exactly the Year 1 Interest & Other Income line. Revenue tab doesn't include Interest as a line; Multi-Year/Overview do.
- **Reproduction:** Compare the Operating Revenue figure across the 3 surfaces for any school with non-trivial cash holdings.
- **Suspected root cause:** Interest is computed by `computeMultiYearDetailed` (year-by-year cash projection) but isn't returned by `calcCommissionRevenue` (used by the Revenue tab). Two engine paths, one labeling pattern.
- **Grep targets:** `interest_rate_on_cash`, `Interest & Other Income`, `Operating Revenue`.
- **Fix scope:** Recommend excluding Interest from Multi-Year's "Operating Revenue" and rendering on a separate row below. Operating Revenue should mean "earned from school operations"; interest from cash is incidental.

### F-007 — Personnel % NOT in Staffing tab header **(Low)**

- **Severity:** Low
- **Surface:** Staffing tab → header area
- **Expected:** Per audit spec, "Personnel % badge in header matches Overview tile."
- **Actual:** No Personnel % indicator visible in Staffing header. Total Personnel Cost shown ($703,300), but not the ratio.
- **Decision needed:** Add Personnel % indicator to Staffing header? If yes, same year-of-operation threshold concern from F-001 applies — must use the F-001/F-011 unified threshold helper.

### F-008 — Transportation row displayed despite `transportation_offered = false` **(Low/cosmetic)**

- **Severity:** Low (cosmetic; numbers are correct in Multi-Year)
- **Surface:** Operations tab
- **Expected:** Per audit spec, "Transportation not displayed (toggle OFF)"
- **Actual:** Transportation row visible with formula `$800/student = $57,600` but empty amount column. Multi-Year correctly shows Transportation expense = $0.
- **Fix scope:** Hide the row entirely when `transportation_offered = false`, or show with explicit "Not enabled" badge replacing the formula.

### F-009 — Food Service expense shows $86,400 formula but contributes $0 **(Low/cosmetic)**

- **Severity:** Low
- **Surface:** Operations tab → Food Service row
- **Expected:** Net-neutral handling (revenue offsets expense per onboarding help text)
- **Actual:** Row shows "$1200/student = $86,400" formula but contributes $0 to actual expenses (correct net-neutral behavior). The displayed formula is misleading.
- **Fix scope:** Add clarifying note next to the Food Service expense row: "Net-neutral (revenue offsets expense)" — or move out of operating expense table entirely.

### F-010 — Year 0 column missing from Multi-Year row data **(Low)**

- **Status:** Same root cause as F-002 (Overview strip). Multi-Year header band mentions "Year 0" but data rows only show Y1–Y5. Y0 startup funding + pre-opening expenses are on the Cash Flow Y0 sub-view.

### F-011 — Three inconsistent assessments of Personnel % across surfaces **(High, escalation of F-001)**

- **Severity:** High (visible inconsistency across multiple founder-facing surfaces)
- **Surfaces:** Overview tile, Overview AI Briefing, Ask SchoolLaunch agent, Staffing Advisor agent (Advisory Panel)
- **Expected:** Single source of truth for the "is 65.3% personnel healthy?" verdict.
- **Actual:** Three different verdicts (the Overview Briefing and Commission Reviewer agent get it right; the tile + Ask agent + Staffing Advisor agent get it wrong).
- **Connection to F-001:** F-001 identified the tile threshold issue; F-011 escalates because the inconsistency is now confirmed across 3 surfaces. **Fix must be at the threshold-definition level (single SoT), not just the tile.**
- **Pre-May-19?** **YES.**

### F-012 — No fiscal year control exposed in Settings **(Low/verify-intent)**

- **Severity:** Low
- **Surface:** Settings tab
- **Expected:** Per audit spec, "Fiscal year start locked at September" — implying a visible-but-disabled control.
- **Actual:** No fiscal year control of any kind on Settings page. Value effectively locked at September (DB stores `fiscal_year_start_month = 9`) but founders can't see or verify it from UI.
- **Decision needed:** Display fiscal year as read-only on Settings for transparency?

---

## Backlog Reproduction Status

| Backlog | Status during this audit | Notes |
|---|---|---|
| P-UX-01 (Revenue tab edit persistence) | **CONFIRMED** | Set Regular Ed override to 999000, reload → empty input, amount reverts to $803,216. Exact match. |
| P-UX-02 (Joyride blocks nav on first visit) | **CONFIRMED** | `elementFromPoint` at Revenue nav link center returned `react-joyride__overlay`. Hard reproduction during Part 1. |
| P-UX-03 (Position driver type not editable) | **CONFIRMED** | Driver column shows static text "Fixed" / "Per Pupil"; no editable input. |
| P-UX-04 (Three overlapping Students/Section controls) | **CONFIRMED** | Master "consistent class size" + Year 1 Grade Config + Grade Expansion Plan tables all editable. |
| P-UX-05 (Settings Danger Zone copy) | RESOLVED in BACKLOG | Tab 12 confirmed Danger Zone section present. Not re-validated for copy. |
| P-UX-06 (Opening year dropdown rolling 4-year window) | Not re-tested | Time-based bug, not exercised. Onboarding used 2027–2028 successfully. |

---

## Single Source of Truth Verification

(See Part 4.1 of `.audit-tmp/part3-findings.md` for the full matrix.)

**Summary:**
- 7 of 9 cross-checked metrics agree across all surfaces
- 2 disagreements (both classification/threshold logic, not engine numbers):
  - F-006: Operating Revenue Revenue tab vs Multi-Year ($3,750 Interest classification)
  - F-001/F-011: Personnel % verdict (3 surfaces disagree on the same number)
- Underlying engine numbers (enrollment, cash, dollar figures) all flow correctly from the canonical engine

---

## Suggested Fix Plan

Ordered by: pre-May-19 blockers first, then by severity, then by blast radius.

### Pre-May-19 (block ship)

**1. F-001 / F-011 — Personnel % threshold logic (consolidated)**
- Files likely involved (after grep): `src/components/HealthTile.tsx` or wherever `Personnel % Revenue` tile lives; `src/lib/buildSchoolContext.ts` (agent context); Ask SchoolLaunch and Staffing Advisor prompts
- Schema changes: none
- Regression testing scope: WA pathway specifically (Generic-pathway personnel norms differ — explicitly out of scope per WA isolation constraint)
- Approach: Create `src/lib/healthThresholds.ts` with `evaluatePersonnelPctHealth(pct, year, status)` returning `{ verdict: 'meets' | 'approaching' | 'fails', explanation: string }`. Founding-year band 65–72% healthy; steady-state 72–78%. Wire tile, briefing context, and agent context through this single function.
- Verification: replicate the 4-surface check (tile + Briefing + Ask + Staffing Advisor) → all 4 should now say "sustainable" for 65.3% in Y1.

**2. F-006 — Operating Revenue Interest classification**
- Files likely involved: `src/lib/budgetEngine.ts` (where Interest is added to revenue), Multi-Year page render, Revenue page
- Schema changes: none
- Approach: Either (a) add Interest as 14th line on Revenue tab (label "Interest & Other Income (non-operating)"), or (b) split Multi-Year's "Operating Revenue" row → Operating Revenue (13 lines) + Total Revenue (includes Interest). Recommendation (b).
- Verification: Operating Revenue Y1 should match exactly across Revenue tab + Multi-Year + Overview Y1 Base Case summary.

### Post-May-19 (UX polish)

**3. F-002 / F-010 — Year 0 column visibility**
- Add Y0 column to Multi-Year row data, OR add Y0 segment to Overview 5-year strip. Information is preserved on Cash Flow Y0 sub-view; this is consolidation.

**4. F-007 — Personnel % badge on Staffing tab**
- Only after F-001/F-011 fixed (uses same threshold helper).

**5. F-008 / F-009 — Operations tab UX**
- Hide Transportation row when toggle is OFF; add "Net-neutral" note to Food Service.

**6. F-012 — Fiscal year display in Settings**
- Read-only display row for `fiscal_year_start_month`.

### Documentation

**7. F-005 — v4.0 spec correction (SSE semantics)**
- Update baseline assertion #5 in audit spec template to reflect SSE-fires-below-minimum.

**8. F-004 — Tile label cosmetic**
- Update Overview Days of Cash tile to show "Meets Stage 1" for Y1-2, "Meets Stage 2" for Y3+ (matching the agent's correct understanding).

### Deferred — out of scope for this audit run

- **4.2 Exports** — Budget Narrative PDF + Commission V8 Excel spot-check requires 30–60s + Anthropic tokens per export. Defer to a focused export-verification session AFTER F-001/F-011 fix, to avoid re-generating after threshold corrections.
- **4.3 Portfolio visibility (ESWA admin login)** — Requires separate auth context (`admin@excellentschoolswa.org`). At the DB level, verified: Evergreen has `organization_id = NULL`, so RLS will not return it for ESWA portfolio queries.
- **4.4 Team role audit (school_viewer)** — Requires inviting a viewer, accepting via email, and logging in. `usePermissions()` hook gates surfaces by role per Phase 1 architecture review.
- **RF-2 Scenarios staleness verification** — Evergreen's scenarios were created post-fix, so no staleness expected. Requires testing on "New School Sample" or "Cedar Grove Public Schools" (both have stored scenarios from before R-ENR-01). Logged in BACKLOG.md.

---

## Operating principles honored

Per audit-prompt Part 6:

- ✅ **Root-cause-first** — F-001 → F-011 escalation traced the threshold issue across 3 surfaces; recommended fix is at the SSoT level, not patching the tile alone
- ✅ **Grep before implementing** — Every finding includes suggested grep targets
- ✅ **WA pathway isolation** — All findings are WA-charter-specific; Generic pathway untouched
- ✅ **Pre-May-19 filter** — F-001/F-011 and F-006 explicitly flagged as block-ship; others tagged post-May-19
- ✅ **Correctness vs polish** — F-006 (correctness) ranks above F-007 (polish)
- ✅ **No git operations** — Phase artifacts saved to `.audit-tmp/`; only this report saved to `audit-reports/`

---

## Artifacts produced

| Path | Purpose |
|---|---|
| `audit-reports/baseline-evergreen-2026-05-11.md` | **This file** — final findings report |
| `.audit-tmp/part2-baseline-snapshot.md` | Part 2 baseline DB snapshot + 10 assertions |
| `.audit-tmp/r-enr-01-phase1.md` | R-ENR-01 Phase 1 diagnosis |
| `.audit-tmp/r-enr-01-phase2.md` | R-ENR-01 Phase 2 engine fix |
| `.audit-tmp/r-enr-01-phase3.md` | R-ENR-01 Phase 3 UI fix |
| `.audit-tmp/r-enr-01-related-findings.md` | Sub-findings (RF-1..4) + Phase 5 verification gates |
| `.audit-tmp/r-enr-01-v40-spec-updates.md` | Spec update notes for next revision |
| `.audit-tmp/eswa-r-enr-01-notice.md` | ESWA communication draft (awaiting Travis review) |
| `.audit-tmp/part3-findings.md` | Tab-by-tab findings detail |
| `audit-01-signup-filled.png` through `audit-23-p3-tab12-settings.png` | 23 screenshots across the audit |

---

## End of report

**Recommended next step:** Travis triages F-001/F-011 and F-006 against the May 19 deadline. Other findings are post-May-19. R-ENR-01 is done.
