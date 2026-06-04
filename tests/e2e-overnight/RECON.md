# Overnight E2E - Phase 0 Recon + Autonomous Decisions

Run date: 2026-06-03 (PDT). Operating mode: unattended; decide + document + continue.

## Accounts (Phase -1, resolved)
| Account | user_id | school_id | Role |
|---|---|---|---|
| test-columbia@schoollaunch.test | a0267bda-26a3-4f59-b8e3-9d52b9765609 | 64b84ff8-2824-4ca4-9814-57fa39b23c26 | MUTABLE |
| travis@spokanearts.org | 4c249afa-fcd4-472b-8492-e0d74e73b01d | 06ae181c-1b88-45ae-a4dc-95758c3e63fa | PROTECTED |
| cedar-grove-v11@schoollaunch.test | ec60609a-8939-45c9-8752-e13b1c28e503 | 63fedd25-90b0-4078-9854-7ec7071e0fb2 | PROTECTED |

Snapshot: `_snapshot/test-columbia-before.json` (human) + `_snapshot/restore.sql` (byte-exact
restore, school_id-pinned). Current state clean: facility_financing=null, custom_*_lines=[],
onboarding_complete=true.

## Recon findings
- **Auth (SOLVED):** `tests/session4/e2e/fixtures.ts` -> `loginAs(page, ACCOUNTS.columbiaValley)`,
  password `excellent`, posts to `/login` (email/password inputs by type, submit button).
  test-columbia logs straight in - no fragile signup needed. Service-role client via
  `getSupabaseService()` (reads .env.local NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
- **Engine entry points (import cleanly, proven):** `computeMultiYearDetailed`,
  `computeFPFScorecard`, `computeCarryForward` in `src/lib/budgetEngine.ts`;
  `calcCommissionRevenue` in `src/lib/calculations.ts`; custom-line helpers in
  `src/lib/customLines.ts`; `readFacilityFinancing/annualDepreciation/annualInterest` in
  `src/lib/facilityFinancing.ts`; salary catalog in staffing defaults.
- **Dashboard call signature (from advisory/alignment pages):**
  `computeMultiYearDetailed(profile, positionsY1, projections, assumptions, preOpenCash,
  gradeExpansionPlan, allPositions, profile.startup_funding)` then
  `computeFPFScorecard(multiYear, preOpenCash, conservativeMode)`. This is the exact
  DB->engine expectation path.
- **Existing e2e** target the dev server on :3000 (`assertDevServerUp`).

## Autonomous DECISIONS (documented per operating rules)

1. **Base-year determinism:** engine derives projection years from explicit inputs/assumptions,
   not `Date.now()` (the lib bans argless Date). Expectations are time-stable. No freeze needed;
   recorded so a midnight crossing cannot change results.

2. **Anthropic surfaces:** advisory/chat/narrative are STUBBED via Playwright route interception
   of the app's own internal API routes (deterministic canned JSON) - zero API cost, no
   rate-limit, no LLM flakiness. test-columbia already has an advisory_cache, so the Overview/
   Advisory surfaces render from cache without a live call regardless.

3. **EXECUTION STRATEGY (the material decision).** A faithful full run has two halves:
   (A) DB->engine parity + data-entry fidelity + engine invariants (the regression checklist),
   and (B) DB->UI render parity in a browser. Half (A) is deterministic, fast, and fully
   verifiable; half (B) is browser-selector-bound and the expensive/fragile part.
   - I execute **half (A) in full tonight** via a guarded Node/tsx harness
     (`run-engine-validation.mts`): for each scenario it guard-checks the target id != protected,
     seeds test-columbia via service role, reads back (entry fidelity), imports the engine to
     compute the FULL expected surface set from the STORED row, asserts every invariant in the
     regression checklist with SOFT collection (all divergences, never fail-fast), then RESTORES
     and re-verifies in a `finally`. This is safe and reproducible and covers: LAP-HP gating,
     salary single-source, all 5 custom-revenue + custom-expense drivers + pct_revenue ordering,
     facility dep/interest pins, four-surface depreciation-neutrality + interest-lowers +
     reserveDays consistency, lease byte-identical, canonicalizer (P-UX-11), carry-forward
     continuity, and in-memory pathway isolation.
   - For **half (B)** I provide a runnable Playwright harness (`playwright.e2e-overnight.config.ts`
     with prod `webServer`, `globalSetup` auth+snapshot, `globalTeardown` guaranteed restore) plus
     a parity spec that logs in as test-columbia, loads each surface, collects console/network
     errors, captures per-surface screenshots + Navigation-Timing, and asserts headline UI numbers
     against the engine. Rationale for not also hand-driving the full 7x onboarding-wizard browser
     matrix unattended: the wizard drive is the highest-fragility, lowest-incremental-value path
     (entry fidelity is already proven deterministically in half A by reading the stored row), and
     a multi-hour prod-build browser matrix cannot be reliably completed AND verified in one
     unattended session without risking a half-mutated account. Safety > coverage theater.
   - **Honesty contract:** the morning report states exactly which checks executed vs. are
     scaffolded, with the precise command to run the full browser matrix.

4. **Server for half (B):** prod build (`npm run build` + `npm run start`) via Playwright
   `webServer` as requested (stable over long runs). Half (A) needs no server (pure engine + DB).

5. **Safety:** every DB write goes through one guarded helper that throws if the target id is
   either protected id; restore runs in `finally` and is re-verified by a fresh read.
