# Session 2 — Scenario Correctness + Operations Page Drift

**Date:** 2026-04-17
**Branch:** master (not pushed — Travis pushes manually)
**Scope:** AUDIT 6.3, 6.4, 6.5 + Session 1 open item (Operations authorizer fee drift) + sweep of stale `budget_projections` reads

---

## Pre-session baseline

`npx playwright test tests/session1 --reporter=list` — **8/8 green** before any changes.

| # | Suite | Test | Status |
|---|---|---|---|
| 1 | 4 | AI auth — unauthenticated 401 | ✅ |
| 2 | 4 | AI auth — missing schoolId 400 | ✅ |
| 3 | 4 | AI auth — own 200 / cross-school 403 | ✅ |
| 4 | 2 | Authorizer fee lock (WA charter) | ✅ |
| 5 | 1 | Spokane Arts — Multi-Year ≡ Excel P&L ($47,640) | ✅ |
| 6 | 1 | Columbia Valley — Multi-Year ≡ Excel P&L ($29,000) | ✅ |
| 7 | 3 | Excel CASH FLOW monthly curve matches per-type distribution | ✅ |
| 8 | 3 | Cash Flow is NOT the pre-Fix3 naive OSPI-on-total formula | ✅ |

Every fix below ran `npm run build` + the full Session 1 suite before moving on — all stayed green throughout.

---

## Fix 1 — Scenario FPF Enrollment Variance (AUDIT 6.3)

**Problem.** `scenarioEngine.ts` hardcoded `fpf_enrollment_variance: 'meets'` regardless of the fill-rate lever. A Conservative scenario (0.80 fill) displayed the same "On Target ✓" badge as a 100% scenario.

**Fix.**

- `src/lib/scenarioEngine.ts`
  - New exported helper `enrollmentVarianceStatus(fillRate)` — 95%+ → `'meets'`, 90–95% → `'approaches'`, <90% → `'does_not_meet'`. FPF Stage 1 and Stage 2 both use the 95% threshold.
  - Added `enrollment_variance_pct: number` to `ScenarioYearResult` (value = `fill_rate − 1`). This drives the UI display.
  - Line 163 `fpf_enrollment_variance: 'meets'` → `enrollmentVarianceStatus(levers.enrollment_fill_rate)`.
- `src/app/(authenticated)/dashboard/scenarios/page.tsx`
  - `fpfValueDisplay()` for `fpf_enrollment_variance` now renders the actual percentage (`-20%`, `+5%`, etc.) or `'On Target'` when pct is within 0.5% of zero.

**Before → after (Spokane Arts default levers).**

| Scenario | Fill rate | Status badge | Display cell |
|---|---:|---|---|
| Conservative | 0.80 | ✅ meets (stale) | On Target (wrong) |
| Base Case | 0.90 | ✅ meets (stale) | On Target (wrong) |
| Optimistic | 0.95 | ✅ meets | On Target |

| Scenario | Fill rate | Status badge | Display cell |
|---|---:|---|---|
| Conservative | 0.80 | ❌ does_not_meet | -20% |
| Base Case | 0.90 | ⚠ approaches | -10% |
| Optimistic | 0.95 | ✅ meets | -5% |

**Verification.** `npm run build` clean; Session 1 suite 8/8 green.

---

## Fix 2 — Scenario Startup Capital double-count (AUDIT 6.4) — **No bug**

**Claim.** The Startup Capital lever overrides `preOpenCash` while the scenario engine still passes `profile.startup_funding` to `computeMultiYearDetailed`, potentially double-counting.

**Investigation.** Traced the data flow end-to-end:

- `startup_funding` allocations are split by year. **Year 0** allocations feed `computeCarryForward(profile)` → `preOpeningNet` (starting cash balance). **Year 1+** allocations feed `getGrantRevenueForYear(startupFunding, y)` → `yearGrantRevenue` on that year's P&L.
- In the scenario path, `preOpenCash = levers.startup_capital` *replaces* the computed carry-forward. But `startup_funding` is still tapped downstream only for Year 1+ grant revenue (which represents CSP/federal startup grants that actually arrive during operating years, distinct from pre-opening cash reserves).
- No overlap. Removing `profile.startup_funding` from the call would incorrectly zero out legitimate Year 1+ startup-grant revenue.

**Verdict:** Case (c) — **no code change.** The two inputs are architecturally distinct and both correct. AUDIT 6.4's hypothesis does not hold against the actual engine behavior.

**Artifact.** `computeCarryForward()` at `src/lib/budgetEngine.ts:101`; `getGrantRevenueForYear()` inside the Y1-5 loop at `src/lib/budgetEngine.ts:528`.

---

## Fix 3 — Scenario engine Y1-only filter (AUDIT 6.5)

**Problem.** `/api/scenarios/calculate/route.ts:38` filtered `budget_projections` with `.eq('year', 1)`. AUDIT 6.5 flagged that this drops Year 2–5 opex rows the main dashboard supposedly honors, creating drift.

**Reality discovered during fix.** Current persistence is Y1-only everywhere — `useSchoolData.ts`, both portfolio surfaces, and the onboarding inserter all only read/write `year = 1`. The engine itself scales Y1 opex forward via the 2%/yr ops escalator and has no per-year opex consumption. **Today there is no drift** because no multi-year rows exist.

**Fix applied (defensive / future-proofing).**

- `src/lib/budgetEngine.ts` — Lines 496–506 `projections.find(p => p.subcategory === 'X')` lookups refactored into a single `y1Ops(sub)` helper that explicitly requires `p.year === 1`. If a caller ever passes mixed-year rows, the engine still correctly picks Y1.
- `src/app/api/scenarios/calculate/route.ts:38` — Removed `.eq('year', 1)` so the route loads all available years.
- `src/app/api/scenarios/calculate/route.ts:53` — `totalOps` hash input pinned to `p.year === 1` rows (matches other callers' hash semantics; prevents hash inflation if multi-year rows arrive).
- `src/lib/scenarioEngine.ts:98` — Lever-4 facility override scoped to Y1 rows only (engine only reads Y1 Facilities; no reason to rewrite Y2+ rows).

**Verification.** `npm run build` clean; Session 1 suite 8/8 green.

**Deferred work.** Actual multi-year opex consumption (allow a Y3 Facilities row to override the escalator-computed Y3) would require an engine refactor out of Y1-scaling mode. Out of scope for this session — see follow-ups.

---

## Fix 4 — Operations page live-computes Authorizer Fee

**Problem.** Surfaced by Session 1 Suite 1. Spokane Arts Operations page showed **$34,480** for Authorizer Fee while Multi-Year and Excel P&L agreed at **$47,640** — a $13,160 delta equal to the SSE + state SPED contribution. The Operations row reads from persisted `budget_projections`, and is marked `isReadOnly` so users can't correct it in-UI.

**Fix.**

- `src/app/(authenticated)/dashboard/operations/page.tsx`
  - Destructured `baseApportionment` from `useScenario()` (already computed + exposed in ScenarioContext via `stateApportionmentBase(baseRev, baseSSE)`).
  - In the row-build `useEffect`, Authorizer Fee now short-circuits the "use DB amount" path and sets `amount = Math.round(baseApportionment × assumptions.authorizer_fee_pct / 100)`. Other operational rows (Facilities, Supplies, etc.) still honor persisted user-authored values.
  - Added `baseApportionment` to the effect's dependency array.

**Test coverage extended.**

- `tests/session1/cross-surface-consistency.spec.ts` — Suite 1 now asserts Multi-Year ≡ Operations ≡ Excel P&L within $1, not just Multi-Year ≡ Excel.
- Preamble comments updated to reflect Fix 4 (Operations live-computes rather than reading persisted DB row).

**Before → after.**

| School | Before (persisted) | After (live) | Δ |
|---|---:|---:|---:|
| Spokane Arts Academy | $34,480 | **$47,640** | +$13,160 |
| Columbia Valley Charter | $29,000 | **$29,000** | 0 |

**Verification.** Suite 1 test log shows `MultiYear=$47640  Operations=$47640(live)  Excel=$47640`. Full Session 1 suite 8/8 green.

---

## Fix 5 — Scan for other stale `budget_projections` display reads

Ran `git grep "budget_projections"` across `src/**/*.ts(x)` and categorized each hit.

### Category 1 — Legitimate engine input (Y1-filtered, feeds live compute)

| Site | Purpose |
|---|---|
| `src/lib/useSchoolData.ts:85` | Loads Y1 projections into ScenarioContext for all dashboard pages. |
| `src/app/api/scenarios/calculate/route.ts:38` | Loads projections for the scenario engine *(Fix 3 removed the Y1 filter; engine now self-filters)*. |
| `src/app/(admin)/portfolio/[schoolId]/page.tsx:88` | Loads Y1 projections for per-school admin view; feeds `computeMultiYearDetailed`. |
| `src/app/(admin)/portfolio/page.tsx:218` | Loads Y1 projections for portfolio summary cards; feeds engine per school. |
| `src/app/(authenticated)/dashboard/operations/page.tsx:202` | Lookup during save to decide UPDATE vs INSERT — not a display read. |

All appropriate. No action.

### Category 2 — Display value fixable now

| Site | Status |
|---|---|
| Operations page — Authorizer Fee row | **Fixed in Fix 4.** |

No other display-drift sites found. Every other dashboard row either (a) reads live engine output (Multi-Year, Scenarios, Dashboard Overview, Ask chat context, advisory agents), or (b) reads persisted values that ARE the source of truth (user-authored ops amounts like Facilities and Supplies).

### Category 3 — Follow-up

| Site | Issue | Priority |
|---|---|---|
| `src/app/(authenticated)/dashboard/staffing/page.tsx:603` | Staffing save writes `subcategory='Total Personnel'` to `budget_projections`. No read site for this row (`git grep` shows only writes from staffing + onboarding; all readers use live `multiYear[y].personnel.total`). Dead cache row — safe to stop writing. | Low — purely cleanup; no user-visible impact. |
| Engine multi-year opex | `computeMultiYearDetailed` still scales Y1 opex forward via the 2%/yr escalator rather than consuming per-year opex rows. Fix 3 laid the defensive groundwork (engine tolerates multi-year input, route no longer filters), but honoring user-authored Y2+ opex would require an engine refactor. | Medium — becomes relevant only if the UI adds a multi-year opex editor. |

---

## Files changed

- `src/lib/scenarioEngine.ts` — Fix 1 (variance helper + result field), Fix 3 (scope lever-4 to Y1)
- `src/lib/budgetEngine.ts` — Fix 3 (engine Y1 opex lookups filter `p.year === 1`)
- `src/app/api/scenarios/calculate/route.ts` — Fix 3 (remove `.eq('year', 1)`, scope hash input to Y1)
- `src/app/(authenticated)/dashboard/scenarios/page.tsx` — Fix 1 (display computed variance instead of `'On Target'`)
- `src/app/(authenticated)/dashboard/operations/page.tsx` — Fix 4 (live-compute Authorizer Fee)
- `tests/session1/cross-surface-consistency.spec.ts` — Extended Suite 1 (Operations ≡ Multi-Year ≡ Excel)

No new files. No migrations. No commits (Travis pushes manually).

---

## Verification summary

| Gate | Result |
|---|---|
| Pre-session Session 1 suite | 8/8 ✅ |
| After Fix 1 — build + Session 1 | Build clean, 8/8 ✅ |
| After Fix 3 — build + Session 1 | Build clean, 8/8 ✅ |
| After Fix 4 — build + Session 1 | Build clean, 8/8 ✅ |
| Suite 1 regression (expanded to assert Operations) | Spokane $47,640 = $47,640 = $47,640 ✅; Columbia $29,000 = $29,000 = $29,000 ✅ |

Fix 2 required no code; Fix 5 was analysis only.

---

## Known follow-ups (not addressed this session)

1. **Scenarios page UI badge legend.** FPF Enrollment Variance now renders computed percentages; the color/semantics are correct but the legend tooltip should surface the "≥ 95% meets / 90–95% approaches / < 90% does not meet" rule explicitly.
2. **Dead `Total Personnel` `budget_projections` cache row** (Fix 5 Category 3 item #1).
3. **Multi-year opex consumption** (Fix 5 Category 3 item #2) — engine still Y1-scales; defensive plumbing is in place but not wired.
4. **Viewer-role authorization test** — still outstanding from Session 1 (requires seeding a `school_viewer` test account).
5. **SSE-in-authorizer-fee contract verification** — still outstanding from Session 1 decision log.
6. **AUDIT 6.1, 6.2, 6.6, 6.7, 6.8** — remaining scenario findings (API authz, hash proxy, input clamping, AI narrative orphaning, hash iteration-order sensitivity). Not in scope for Session 2.
