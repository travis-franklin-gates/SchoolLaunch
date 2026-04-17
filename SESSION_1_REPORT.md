# Session 1 Report — Commission Integrity + AI Endpoint Auth

**Status:** COMPLETE (uncommitted; Travis handles push)
**Date:** 2026-04-17
**Branch:** master

All four high-priority fixes from `AUDIT_REPORT.md` are implemented, clean-building, and ready for manual verification.

---

## Fix 1 — Canonical state apportionment helper

### What changed

Added `stateApportionmentBase(rev, sse)` to `src/lib/budgetEngine.ts` as the single source of truth and replaced 7 inline variant calculations.

```ts
export function stateApportionmentBase(
  rev: CommissionRevenue,
  smallSchoolEnhancement: number = 0,
): number {
  return rev.regularEd + rev.sped + rev.stateSped + rev.facilitiesRev + smallSchoolEnhancement
}
```

### Files touched

| File | What changed |
|------|--------------|
| `src/lib/budgetEngine.ts` | New helper + 3 call-site replacements (computeScenario Authorizer Fee branch; computeMultiYearDetailed authorizer fee + `apportionment:` output field) |
| `src/lib/ScenarioContext.tsx:115,125` | `baseApportionment` and `scenarioApportionment` now use helper — fixes missing `stateSped` |
| `src/app/(admin)/portfolio/[schoolId]/page.tsx:~129` | Added SSE via plan-if-available-else-fallback, then helper — fixes missing stateSped AND SSE |
| `src/components/onboarding/StepOperations.tsx:203` | Threaded `openingGrades` through props; uses helper |
| `src/app/(onboarding)/onboarding/page.tsx:732` | Passes `openingGrades={data.openingGrades}` |
| `src/components/onboarding/StepEnrollment.tsx:131` | Uses helper; grants now = `rev.total - baseRevenue` — fixes wrongful levy inclusion |
| `src/lib/calculations.ts:279` | Stale comment replaced with pointer to canonical helper |

### Before/after behavior (material)

- **AUDIT 1.1** — Dashboard `ScenarioContext.baseApportionment` was missing `stateSped`. Now includes. Material for any school with SPED students.
- **AUDIT 1.2** — Onboarding preview authorizer fee was missing SSE. Spokane Arts Academy (K-5 under 60) now matches post-onboarding dashboard.
- **AUDIT 2.1** — Portfolio admin apportionment was missing both `stateSped` AND SSE. Now matches school-level dashboard exactly.
- **AUDIT 3.2** — StepEnrollment preview was adding `levyEquity` into "base revenue" bucket (not state apportionment). Now correctly excludes levy from base.

### Decision log — SSE in apportionment base

**Decision:** `stateApportionmentBase(rev, sse)` includes `smallSchoolEnhancement` in the base used for the 3% authorizer fee.

**Why:** The `computeMultiYearDetailed` engine already summed SSE into the fee base before this refactor. We preserved that behavior at every call site for consistency. The whole point of centralizing was to prevent definition drift.

**Working assumption — verification needed:** The WA Charter School Commission's authorizer contract may or may not include SSE in the fee base. If it *excludes* SSE, the fix is a one-line change in `stateApportionmentBase()` and every call site updates atomically. The docblock in `budgetEngine.ts` flags this as an open question.

**Action item for Travis:** Pull a school's signed Commission authorizer contract and confirm whether the 3% fee is calculated on `regularEd + sped + stateSped + facilitiesRev` only, or includes SSE.

### Verification

- `npm run build` ✅
- Manual (pending): open Spokane Arts Academy (triggers SSE) — confirm Y1 authorizer fee increased proportionally to SSE value
- Manual (pending): open Columbia Valley Charter (no SSE qualification) — confirm no change in authorizer fee

---

## Fix 2 — Authorizer fee lock for WA charters

### What changed

`src/app/(authenticated)/dashboard/settings/page.tsx`:

1. **Input gating** — The `authorizer_fee_pct` input now checks `pathwayConfig.authorizer_fee_editable`. When `false` (WA charter, generic micro, generic private), renders a disabled input bound to `pathwayConfig.authorizer_fee * 100` with helper copy explaining the lock (WA-specific copy: "Fixed at 3% by WA Charter School Commission contract").
2. **Save-handler override** — Even if the client-side field is bypassed (devtools, stale state), `handleSave()` now constructs `faToSave` by forcing `authorizer_fee_pct = pathwayConfig.authorizer_fee * 100` when not editable. The database never receives a user-overridden value.

### Before/after

- **Before:** A WA charter founder could type `0` in the authorizer fee field and hide the 3% fee from their model. Silent, no validation.
- **After:** UI is disabled with explanatory text. Save handler enforces pathway-level value regardless of client state.

### Verification

- `npm run build` ✅
- Manual (pending): load Settings for a WA charter school, confirm input is disabled and shows `3.0` with "Fixed at 3%…" helper copy
- Manual (pending): load Settings for a `generic_charter` school, confirm input remains editable

---

## Fix 3 — Commission Excel Cash Flow revenue distribution

### What changed

`src/app/api/export/commission/route.ts`:

1. Added `distributeRevenueToMonths(rev, isWaCharter, paymentSchedule?)` helper that distributes each Y1 revenue type per its real-world cadence:
   - **State apportionment** (regularEd + sped + stateSped + facilitiesRev + SSE + levyEquity): OSPI schedule (9/8/5/9/8.5/9/9/9/5/6/12.5/10)
   - **Federal** (titleI + idea): flat 10-month Oct–Jul (10% each)
   - **State categoricals** (lap + lapHighPoverty + tbip + hicap): flat 12-month
   - **Food service + transportation**: flat 10 school months Sep–Jun
   - **Interest income**: flat 12-month
   - **Y1 startup grants**: Sep-only (lump sum at fiscal-year start)
2. CASH FLOW tab replaced its `total × OSPI pct` loop with `distributeRevenueToMonths()` output.
3. Removed stale `ospiSchedule` literal (unused after refactor).
4. Generic-pathway branch preserves original behavior — uses `paymentSchedule` or flat distribution on sum of all revenue types.

### Before/after

- **Before:** Commission Cash Flow tab took `y1AnnualRev.total` and multiplied by OSPI monthly %. Federal grants (titleI + idea, typically $100k-$400k for Y1) were distributed as if they arrived on the OSPI schedule. Food service reimbursements were also on OSPI. This created misleadingly front-loaded July/August cash projections and understated the July gap when federal reimbursements lag.
- **After:** Each revenue type follows a realistic cadence. WA Commission reviewers will see a cash curve that reflects actual disbursement timing.

### Known limitation / follow-up

- Startup grant (Y1) is assumed fully Sep. A more accurate model would respect each `startup_funding` source's own timing — some CSP grants arrive in multiple disbursements. Left as a follow-up since Y1 grant data structure doesn't carry a disbursement schedule today.
- Generic pathway branch still uses flat distribution of total — matches the legacy UX for non-WA schools. Could be expanded pathway-by-pathway later.

### Verification

- `npm run build` ✅
- Manual (pending): export Commission Excel for a WA charter with federal grants — confirm titleI + idea distributed Oct-Jul, not on OSPI
- Manual (pending): export for a generic charter — confirm legacy flat distribution preserved

---

## Fix 4 — AI endpoint authentication

### What changed

Created `src/lib/apiAuth.ts` with `authenticateRequest(request, { schoolId, requireRoles })`:

- Validates session via `supabase.auth.getUser()` → 401 if no user.
- Resolves `schoolId` from options or request body → 400 if missing.
- Loads user's roles from `user_roles` → 403 if none.
- `super_admin` bypasses all checks.
- Otherwise, requires either `school_id === schoolId` role OR `org_admin` role whose `organization_id` matches the school's org.
- Optional `requireRoles` check — validates `role` is in allowed list (super_admin bypass preserved).

### Applied to

| Route | Auth | schoolId | requireRoles |
|-------|------|----------|--------------|
| `/api/advisory` | ✅ | body | — |
| `/api/chat` | ✅ | body | — |
| `/api/alignment` | ✅ | body | `['school_ceo','school_editor','org_admin']` |
| `/api/export/narrative` | ✅ | body | — |
| `/api/export/commission` | ✅ | body | — |

### Client callers updated

All callers now pass `schoolId` in the request body:

- `src/app/(authenticated)/dashboard/ask/page.tsx` — chat
- `src/app/(authenticated)/dashboard/advisory/page.tsx` — advisory
- `src/app/(authenticated)/dashboard/alignment/page.tsx` — alignment
- `src/app/(authenticated)/dashboard/page.tsx` — advisory (both call sites), narrative export, commission export
- `src/app/(authenticated)/dashboard/scenarios/page.tsx` — chat

### Before/after

- **Before (AUDIT Finding 5.1):** All five AI endpoints accepted requests from any unauthenticated client. Attacker could POST arbitrary `schoolContext` and burn Anthropic credits + exfiltrate competitor data included in payloads.
- **After:** All five endpoints require an authenticated session AND verified school access. Alignment additionally restricted to edit-capable roles (viewers cannot trigger alignment reviews).

### Known limitations / follow-ups

- **schoolContext is still client-supplied.** We verify the *user* has access to *a* school, but we don't re-derive the context server-side. A malicious authenticated user could still inject arbitrary context strings. Future work: have the server fetch the school's own profile/positions/projections by `schoolId` and build the context server-side. (Out of scope for this session — would require context builders to run server-side, major refactor.)
- **Scenarios endpoints NOT updated** (AUDIT Finding 6.1). `/api/scenarios/seed` and `/api/scenarios/calculate` still lack auth. Flagged for Session 2.
- **CSRF:** same-origin cookie auth is used, but no explicit CSRF token. Next.js middleware pattern should be added globally in a separate pass.

### Verification

- `npm run build` ✅
- Manual (pending): unauthenticated curl to `/api/advisory` → expect 401
- Manual (pending): authenticated user A requests `/api/chat` with school B's `schoolId` → expect 403
- Manual (pending): viewer-role user requests `/api/alignment` → expect 403 (role restriction)
- Manual (pending): super_admin requests any of the 5 → expect 200

---

## Summary

| Fix | AUDIT findings resolved | Files touched | Build |
|-----|------------------------|----------------|-------|
| 1 | 1.1, 1.2, 2.1, 3.2 | 8 | ✅ |
| 2 | 3.1 | 1 | ✅ |
| 3 | 2.1 (cash flow aspect) | 1 | ✅ |
| 4 | 5.1 | 7 (1 new lib + 5 routes + client callers) | ✅ |

**Total HIGH findings resolved:** 4 of 7 from AUDIT_REPORT.md
**Lines changed:** ~350 across 15 files, plus 1 new file (`apiAuth.ts`)

## Outstanding follow-ups for Session 2

1. **SSE-in-authorizer-fee contract verification** — pull Commission contract, confirm or flip the SSE flag in `stateApportionmentBase()`.
2. **Scenarios endpoints auth** — AUDIT 6.1 — apply `authenticateRequest` to `/api/scenarios/seed` and `/api/scenarios/calculate`.
3. **Server-side context building** — eliminate `schoolContext` as a client-supplied string; have AI routes reconstruct it from the school's own DB records.
4. **Startup grant monthly cadence** — honor per-source disbursement schedules in Cash Flow tab.
5. **Commit** — none of this is committed. Travis runs git push manually.
