# Session 1 — Playwright Verification Report

**Date:** 2026-04-17
**Branch:** master
**Base URL:** http://localhost:3000
**Status:** ✅ All 8 tests pass — four Session 1 fixes verified end-to-end

Re-run:

```bash
npx playwright test tests/session1 --reporter=list
```

---

## Result matrix

| # | Suite | Test | Status | Notes |
|---|---|---|---|---|
| 1a | Suite 1 | Spokane Arts — Multi-Year ≡ Excel P&L Y1 fee | ✅ | $47,640 / $47,640 |
| 1b | Suite 1 | Columbia Valley — Multi-Year ≡ Excel P&L Y1 fee | ✅ | $29,000 / $29,000 |
| 2 | Suite 2 | WA-charter authorizer fee input locked + save-handler override | ✅ | Disabled; persisted = 3% |
| 3a | Suite 3 | Monthly revenue curve matches per-type distribution | ✅ | 11 of 12 months match within $5; Sep residual = $350,000 = startup grants |
| 3b | Suite 3 | Curve is NOT the pre-Fix3 naive `total × OSPI%` formula | ✅ | ≥ 3 months diverge by > $1,000; Aug < naive |
| 4a | Suite 4 | Unauthenticated → 401 on all 5 AI routes | ✅ | advisory, chat, alignment, export/narrative, export/commission |
| 4b | Suite 4 | Missing `schoolId` → 400 on all 5 routes | ✅ | |
| 4c | Suite 4 | Own school 200/OK; cross-school → 403 | ✅ | Spokane CEO blocked from Columbia schoolId |

---

## Suite 1 — Cross-surface authorizer fee consistency

**Scope adjustment from the brief.** The brief listed 6 surfaces (Overview, Multi-Year, Scenarios, Settings, Excel P&L, Excel Cash Flow). Only two actually display a per-line Year 1 Authorizer Fee amount:

- **Multi-Year** → `<Row label="Authorizer Fee" ...>` column 1
- **Excel P&L tab** → row `Authorizer Fee`, column `Year 1`

The other surfaces expose only aggregate totals (Overview totalOps, Scenarios aggregate FPF metrics, Settings shows the *rate* not the dollar amount, Excel Cash Flow aggregates monthly Expenses). The test reports their absence and restricts the pass/fail assertion to the two canonical surfaces.

**Third surface tracked for observation:** the Dashboard Operations page row `[data-tour="authorizer-fee"]`. This cell reads from `budget_projections` (a persisted value), not a live compute — so it drifts whenever revenue mix or enrollment changes. We capture it for reporting.

### Observed values

| School | Multi-Year (Y1) | Excel P&L (Y1) | Operations (persisted) | Canonical match? |
|---|---:|---:|---:|:---:|
| Spokane Arts Academy | $47,640 | $47,640 | $34,480 | ✅ |
| Columbia Valley Charter | $29,000 | $29,000 | $29,000 | ✅ |

### Finding worth flagging

Spokane Arts Operations page shows **$34,480** while Multi-Year and Excel agree at **$47,640**. The $13,160 delta is exactly the SSE + state SPED contribution the school qualifies for. The Operations page pulls its value from `budget_projections` (last-saved), so the row contains a pre-Fix-1 value.

- **Not a regression from Fix 1** — the fix deliberately did not touch `src/app/(authenticated)/dashboard/operations/page.tsx` (that page persists its own amounts).
- **Latent bug** — the Operations `Authorizer Fee` row is marked `isReadOnly`, so users can't correct it in-UI. It will only refresh if the ops `save()` handler is re-run.
- Columbia Valley matches across all three because it doesn't qualify for SSE and its persisted ops value already aligned with the canonical compute.

Recommended Session 2 follow-up: make the dashboard Operations `Authorizer Fee` cell live-compute via `stateApportionmentBase()` instead of reading persisted projections, or auto-recompute the persisted row whenever Revenue is saved.

---

## Suite 2 — Authorizer fee lock (WA charter)

Ran against Spokane Arts CEO (wa_charter pathway).

- `input[type=number]` for "Authorizer Fee (%)" is rendered with the `disabled` attribute ✅
- Displayed value = `3.0` ✅
- Helper copy exact: "Fixed at 3% by WA Charter School Commission contract." ✅
- Bypass attempt: test removed `disabled`, set the input to `0` via native setter + `input`/`change` events, clicked Save. ✅
- Verified `school_profiles.financial_assumptions.authorizer_fee_pct = 3` via Supabase service role both before and after the bypass attempt — save-handler override stuck.

---

## Suite 3 — Commission Excel CASH FLOW distribution

Downloaded `Spokane_Arts_Academy_Commission_Template.xlsx` via the `Export for Commission` button on Dashboard Overview.

### Monthly revenue curve (Y1)

| Month | Actual | Predicted (per-type formula, no startup) | Δ |
|---|---:|---:|---:|
| Sep | 511,957 | 161,957 | **+350,000** ← startup grant lump |
| Oct | 150,981 | 150,981 | 0 |
| Nov | 103,341 | 103,341 | 0 |
| Dec | 166,861 | 166,861 | 0 |
| Jan | 158,921 | 158,921 | 0 |
| Feb | 166,861 | 166,861 | 0 |
| Mar | 166,861 | 166,861 | 0 |
| Apr | 166,861 | 166,861 | 0 |
| May | 103,341 | 103,341 | 0 |
| Jun | 119,221 | 119,221 | 0 |
| Jul | 210,248 | 210,248 | 0 |
| Aug | 165,645 | 165,645 | 0 |

- **Sep residual = $350,000** matches Spokane Arts' Y1 startup grant revenue as expected (Sep-only lump sum).
- Non-Sep months match predicted values to the dollar — confirms state apportionment → OSPI, federal → Oct-Jul flat, state categoricals → 12-mo flat, food+transport → Sep-Jun flat, interest → 12-mo flat.
- Sum of monthly Revenue ≈ Y1 Total Revenue from P&L (within $20 of rounding tolerance).
- Aug (165,645) is strictly less than the pre-Fix3 naive value (y1Total × 10%), since Aug receives no federal, food/transport, or startup contributions under the new formula.
- ≥ 3 months diverge by > $1,000 from the naive `total × OSPI%` curve, confirming the refactor is live.

---

## Suite 4 — AI endpoint authentication

Tested all 5 endpoints:

- `/api/advisory`
- `/api/chat`
- `/api/alignment`
- `/api/export/narrative`
- `/api/export/commission`

### Results

| Scenario | Expected | Actual (all 5) |
|---|---|---|
| Unauthenticated POST | 401 | ✅ 401 |
| Missing `schoolId` in body (authenticated) | 400 | ✅ 400 |
| Own school (Spokane CEO posts Spokane schoolId) | Not 401/403 | ✅ Not 401/403 |
| Cross-school (Spokane CEO posts Columbia schoolId) | 403 | ✅ 403 |

Viewer-role test for `/api/alignment`'s `requireRoles: ['school_ceo', 'school_editor', 'org_admin']` enforcement was not exercised because no viewer-role test account is pre-provisioned. The requireRoles path is present in `apiAuth.ts` and wired to `/api/alignment` in source (already covered by unit-level confidence from cross-school 403 coverage). Follow-up: seed a `school_viewer` test account and add a 403-on-viewer case in Session 2.

---

## Test files

```
tests/session1/
├── fixtures.ts                              # shared helpers (login, Excel parsing, Supabase)
├── cross-surface-consistency.spec.ts        # Suite 1 (Fix 1)
├── authorizer-fee-lock.spec.ts              # Suite 2 (Fix 2)
├── excel-cashflow.spec.ts                   # Suite 3 (Fix 3)
├── ai-auth.spec.ts                          # Suite 4 (Fix 4)
├── artifacts/                               # downloaded .xlsx files (git-ignored; regenerated each run)
│   ├── spokaneArts_commission.xlsx
│   ├── columbiaValley_commission.xlsx
│   └── spokaneArts_cashflow.xlsx
└── VERIFICATION_REPORT.md                   # this file
```

Config:

- `playwright.config.ts` — chromium-only, serial (`workers: 1`), no retries, 60s test timeout, 10s expect timeout
- `baseURL = http://localhost:3000` — assumes dev server is already running (do not start from tests)
- Env: `.env.local` is auto-loaded by `fixtures.ts`'s `loadEnvLocal()` via the `loadedEnv` test fixture

---

## Follow-ups surfaced by verification

1. **Operations page authorizer fee drift** (surfaced by Suite 1 observation). Dashboard Operations reads persisted `budget_projections` for authorizer fee, so it drifts whenever revenue changes post-save. Either live-compute it or auto-recompute on Revenue save. Material for any WA charter that qualifies for SSE.
2. **Viewer-role authorization test** (Suite 4 coverage gap). Seed a `school_viewer` account at a fixture school and add a case that asserts 403 on `/api/alignment` for viewers. The code path exists (`requireRoles: ['school_ceo','school_editor','org_admin']`); verification was deferred.
3. **Startup grant monthly cadence** (Suite 3 confirmed current behavior). Current code assumes 100% of startup grants land in Sep. If future CSP grants carry a disbursement schedule, honor it.
4. **SSE-in-authorizer-fee contract verification** (outstanding from Session 1 decision log). Pull a signed Commission authorizer contract and confirm whether the 3% fee base includes SSE. Fix is a one-line change in `stateApportionmentBase()` if wrong; all call sites pick up atomically.
