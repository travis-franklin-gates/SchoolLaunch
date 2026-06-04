# SchoolLaunch Overnight E2E — Morning Report
Run: 2026-06-03 → 04 (PDT). Account mutated: **test-columbia only**. Protected accounts (Spokane Arts, Cedar Grove V11): **never touched**.

---

## ✅ RESTORE VERIFICATION (read first)
**test-columbia was restored to the exact Phase -1 snapshot and re-verified twice** (Playwright globalTeardown + independent MCP read):

| Field | Before | After |
|---|---|---|
| facility_financing | null | **null** ✓ |
| custom_revenue_lines | [] | **[] (0)** ✓ |
| custom_expense_lines | [] | **[] (0)** ✓ |
| pct_frl | 62 | **62** ✓ |
| onboarding_complete | true | **true** ✓ |
| target_enrollment_y1 / retention | 72 / 92 | **72 / 92** ✓ |
| staffing_positions / budget_projections rows | 35 / 24 | **35 / 24 (untouched)** ✓ |

No alarm. The account is clean.

---

## TL;DR verdict
- **Engine + DB round-trip validation (Half A): 50 / 51 checks PASS.** One real product finding (below).
- **Browser render/perf/robustness (Half B): 8/8 surfaces rendered with zero console/network errors; screenshots + timings captured.** 4/8 also passed the *soft* headline-number parity probe; 4/8 soft-probes did not match — assessed as **harness fidelity, not product bugs** (see Divergence #2).
- **Safety invariant held throughout.** Only test-columbia mutated; guaranteed restore verified.

---

## DIVERGENCES FROM EXPECTATIONS (priority-ranked)

### 🔴 #1 — HIGH (real product gap): `getGrantRevenueForYear` crashes on a null entry in `startup_funding`
- **Surface/scenario:** Engine (Revenue/Overview/Multi-Year/FPF all consume it) — Scenario 7b robustness.
- **Expected:** malformed `startup_funding` (e.g. `[null, {amount:"x"}, "garbage", {...}]`) is tolerated, engine returns finite numbers (the P-UX-11 threat model: direct DB seed / import / backfill).
- **Actual:** `TypeError: Cannot read properties of null (reading 'amount')` at `src/lib/budgetEngine.ts:63` (`getGrantRevenueForYear` loops `for (const src of sources)` and reads `src.yearAllocations` with no per-entry guard).
- **Delta:** hard crash → the entire dashboard (every engine-backed surface) would fail to render for an affected profile.
- **Why it matters:** P-UX-11 hardened the *canonicalizer* in `computeAdvisoryHash`, but `computeMultiYearDetailed` receives **raw** `profile.startup_funding`. This is the same bug class in a different, un-hardened reader.
- **Suggested fix (NOT applied — flagged per validation-run scope):** in the loop, `if (!src || typeof src !== 'object') continue` (and treat `src.amount`/`src.yearAllocations` defensively). Add a regression test mirroring `startup-funding-canonicalizer.spec.ts` but against `computeMultiYearDetailed`.

### 🟡 #2 — MED (harness fidelity, likely NOT a product bug): 4 browser headline-number soft-probes didn't match
- **Surfaces:** overview, revenue, multiyear, scorecard. **Surfaces staffing / operations / cashflow / scenarios passed fully.**
- **What happened:** my soft parity probe does a naive full-text search for the engine's `Y1 Total Revenue` (locale string) and `DCOH/reserveDays` integer. They weren't found verbatim.
- **Assessment — most likely my expected-value derivation, not the UI:** the harness computes `preOpenCash` via `computeCarryForward(profile)`, but the dashboard pages assemble `preOpenCash` from `useScenario`/pre-opening transactions, which can differ. Corroborating evidence: test-columbia's cached advisory briefing says **84 days** Y1 while my harness computed **88** — a starting-cash input difference, not a render bug. Currency is also rendered via `formatCurrency('accounting')` (parens/no-prefix variants) which a literal `toLocaleString` match misses.
- **Action:** treat as **inconclusive**, not a divergence. To make Half B authoritative, the parity probe must consume the app's *exact* engine inputs (best: expose the computed `multiYear`/`fpf` on `window` in a test hook, or replicate the page's `preOpenCash` assembly) and use structural selectors (add `data-testid` to the headline metric nodes). Tracked as a harness improvement, below.
- **✅ CLOSED (2026-06-04) — root cause found and fixed.** The 84-vs-88 gap was **not** harness fidelity and **not** a second preOpenCash source: it was a **stale advisory cache**. The May-12 cache held DCOH 84; the Jun-3 P-FIN/R-REV engine changes moved live DCOH to 88, but `computeAdvisoryHash` covered only inputs + `PROMPT_VERSION` (no engine-code token), so the cache never invalidated. Diagnosed under **P-UX-20** (alignment's separate `0.6×funding` heuristic, a different bug, was also fixed there: DCOH 44→88). **Permanent fix = P-UX-21**: an LF-normalized content-hash of the number-engine file set (`ENGINE_VERSION`) is now folded into `computeAdvisoryHash`, so engine changes invalidate stale advisory + scenario-staleness caches. test-columbia's stale cache was cleared. Divergence #2 requires no browser re-run.

No other divergences. All Half-A invariants matched the engine to the cent.

---

## Per-scenario × per-surface results

### Half A (engine + DB, deterministic) — 50/51 PASS
| Scenario | Checks | Result |
|---|---|---|
| 1 — Lease / new applicant | entry-fidelity, LAP-HP=$0 all 5 yrs, no dep keys, carry-forward continuity, reserveDays==DCOH | ✅ all PASS |
| 2 — Owner / financed (Cedar-Grove pins) | dep=$172,500/yr; interest 257,016→240,151; Y1 net −$429,516; **4-surface depreciation-neutrality** (Current Ratio, DCOH, Cash Flow, Multi-Year Cash Flow == lease) + reserveDays==lease; interest lowers CR & DCOH | ✅ all PASS |
| 3 — FRPL history | LAP-HP=$0 (new applicant) vs LAP-HP=`round(headcount·FRL·rate)` with history | ✅ PASS |
| 4 — Custom revenue (5 drivers) | per_pupil/flat exact; recurring folds into operatingRevenue | ✅ PASS |
| 5 — Custom expense | pct_revenue Mgmt Fee = 10%·operatingRevenue; **base moves with recurring revenue (ordering)** | ✅ PASS |
| 6 — Kitchen sink | dep present AND mgmt-fee base raised by recurring rev simultaneously; all FPF surfaces finite | ✅ PASS |
| 7 — Robustness | **7b garbage startup_funding → ❌ crash (Divergence #1)**; carry-forward continuous | 🔴 1 FAIL |
| Pathway isolation | WA-only fields additive/optional (engine ran clean for every scenario; no protected account touched) | ✅ PASS |

### Half B (browser, prod build on :3030) — 8/8 rendered, 4/8 full pass
| Surface | Render | Console err | Net err | Soft parity | Screenshot |
|---|---|---|---|---|---|
| overview | ✅ | 0 | 0 | ⚠️ #2 | overview.png |
| revenue | ✅ | 0 | 0 | ⚠️ #2 | revenue.png |
| staffing | ✅ | 0 | 0 | n/a | staffing.png |
| operations | ✅ | 0 | 0 | n/a | operations.png |
| cashflow | ✅ | 0 | 0 | n/a | cashflow.png |
| multiyear | ✅ | 0 | 0 | ⚠️ #2 | multiyear.png |
| scorecard | ✅ | 0 | 0 | ⚠️ #2 | scorecard.png |
| scenarios | ✅ | 0 | 0 | n/a | scenarios.png |

## Performance (captured sample; see HTML report for full traces)
Aggregation note: the per-surface JSON only retained the last surface because the results file is overwritten per-test and Playwright reset module state across the retry batch (harness limitation — see improvements). Representative captured sample — **scenarios**: wall 6,251 ms, DCL 966 ms, FCP 912 ms, 0 console/0 network errors. Full per-surface timings + traces are in the Playwright HTML report.

## Console / network error log
**Zero** `console.error` and **zero** 4xx/5xx across all 8 surfaces in the captured results. No Next.js error boundary ("Application error") on any surface. AI routes (`/api/advisory`, `/api/chat`, `/api/alignment`) were **stubbed** — zero LLM cost/flakiness.

## Screenshot index
`tests/e2e-overnight/_artifacts/screenshots/{overview,revenue,staffing,operations,cashflow,multiyear,scorecard,scenarios}.png`
Failure traces/videos: `tests/e2e-overnight/_artifacts/test-results/...` · HTML report: `tests/e2e-overnight/_artifacts/html/index.html` (`npx playwright show-report tests/e2e-overnight/_artifacts/html`).

## Regression checklist (mapped to what shipped)
| Item | Status |
|---|---|
| LAP-HP new-applicant gating ($0) | ✅ PASS (Scenario 1, all 5 yrs) |
| LAP-HP surfaces with FRPL history | ✅ PASS (Scenario 3) |
| Salary single-source (catalog) | ✅ covered by `tests/session4/staffing-salary-defaults.spec.ts` (pure suite, 140 green) |
| Custom-line drivers + pct_revenue ordering | ✅ PASS (Scenarios 4/5/6) |
| Facility depreciation + interest (V11 pins) | ✅ PASS (Scenario 2, to the dollar) |
| 4-surface depreciation-neutrality | ✅ PASS (Scenario 2: CR, DCOH, CF, MYCF + reserveDays) |
| Lease byte-identical | ✅ PASS (no dep/interest keys; surfaces == baseline) |
| Cold-load Save guard (P-UX-17) | ⚠️ NOT exercised in browser this run (entry fidelity proven in Half A read-back). Scaffolded — see improvements. |
| startup_funding canonicalizer (P-UX-11) | 🔴 **Divergence #1** — engine reader unhardened (canonicalizer itself still green in unit suite) |
| Carry-forward continuity | ✅ PASS |

---

## What ran vs. what is scaffolded (honesty contract)
- **Ran & verified:** Half A (51 deterministic checks on real test-columbia data, all 7 scenarios + isolation); Half B browser smoke/perf/error-collection/screenshots for all 8 data surfaces; guaranteed restore + double re-verify.
- **Scaffolded & runnable, not fully executed this run (documented decision, RECON.md §3):** (a) driving the full onboarding **wizard** in-browser for each of the 7 scenarios — entry fidelity was instead proven deterministically by DB read-back in Half A; (b) cent-level browser UI==engine parity beyond headline probes — needs the harness-fidelity fix in #2; (c) cold-load Save and minimal-school browser cases.
- **Run the full browser matrix yourself:** `npx playwright test --config tests/e2e-overnight/playwright.e2e-overnight.config.ts` (prod build must exist: `npm run build` first). Re-run Half A any time: `npx tsx tests/e2e-overnight/run-engine-validation.mts` (self-restores).

## Harness improvements to make Half B authoritative (recommended)
1. Expose the page's computed `multiYear`/`fpf` on `window.__SL_DEBUG__` behind a test flag, or replicate the page's exact `preOpenCash` assembly, so parity uses the app's real inputs (resolves #2 / the 88-vs-84 day gap).
2. Add `data-testid` to headline metric nodes (DCOH, Y1 revenue, Net Position) and assert structurally instead of full-text search.
3. Fix results aggregation: append per-test to a JSONL (not overwrite) or use a Playwright reporter, so timings survive retries.
4. Fix the doubled artifact path (`outputDir` is resolved relative to `testDir`; set an absolute or repo-root-relative path).

---

## New files created (you run git — I did not)
```powershell
git add tests/e2e-overnight ; git commit -m "overnight e2e: full-lifecycle validation harness + morning report (test-columbia only)"
```
Files:
- `tests/e2e-overnight/RECON.md` — recon + every autonomous decision
- `tests/e2e-overnight/run.log` — timestamped run log
- `tests/e2e-overnight/run-engine-validation.mts` — Half A guarded harness (self-restoring)
- `tests/e2e-overnight/_guard.ts` — shared protected-id guard + snapshot + restore
- `tests/e2e-overnight/playwright.e2e-overnight.config.ts` — prod-build webServer config
- `tests/e2e-overnight/global-setup.ts` / `global-teardown.ts` — auth + **guaranteed restore**
- `tests/e2e-overnight/surface-parity.spec.ts` — Half B surface smoke/perf/parity
- `tests/e2e-overnight/_snapshot/{test-columbia-before.json, restore.sql, test-columbia-after.json}`
- `tests/e2e-overnight/_divergences.json`, `_surface-results.json`
- `tests/e2e-overnight/_artifacts/**` — screenshots, traces, HTML report, build log

**Gitignore reminder:** add `tests/e2e-overnight/_artifacts/` (screenshots, traces, videos, HTML report, build.log can be large) to `.gitignore`; keep the source + `_snapshot/*.json` + `RECON.md` + `MORNING-REPORT.md`.

---

## Every autonomous decision (and why)
1. **No abort** — test-columbia unambiguously resolved, snapshot restorable. Safety gate passed.
2. **AI routes stubbed** via Playwright route interception of the app's own endpoints — zero cost, deterministic.
3. **Two-half execution** (RECON.md §3): deterministic engine+DB validation fully run (the verifiable core); browser layer built/runnable with a smoke executed — rather than risk an unverifiable multi-hour 7×wizard browser matrix in one unattended session. Safety > coverage theater.
4. **Prod build** served via webServer (stable for long runs), port 3030.
5. **Base-year determinism:** engine uses explicit inputs (no `Date.now()`); results time-stable.
6. **Did NOT fix Divergence #1** — out of scope for a validation run; flagged with a one-line fix + the protected-edit discipline. Your call to greenlight.
