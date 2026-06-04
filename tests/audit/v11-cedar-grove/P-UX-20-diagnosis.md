# P-UX-20 — Single source of truth for pre-opening cash (Phase 0 inventory)

Read-only inventory; HARD STOP after the Match/Drift table + Divergence #2 verdict. No
reroutes/deletions until approved. `tests/**` excluded from prod build.

MCP pre-flight: supabase LIVE (ref nlvlrznhiwuorxlapnej confirmed); github LIVE (read-only);
typescript-lsp UNAVAILABLE (grep fallback); playwright available (not needed — static analysis
+ DB read sufficed); context7 n/a.

## Premise corrections
- **multiyear/page.tsx does NOT re-implement the carry-forward total.** It already calls
  `computeCarryForward` at **line 35** (feeds the engine call AND the displayed "Carry-Forward
  to Year 1", line 174). Only the two *component* displays — "Year 0 Funding" (year0Total memo,
  :38-48) and "Pre-Opening Spend" (preOpenExpenses, :49-52) — are re-derived, and :49-51 read
  `pre_opening_*` RAW (the residual P-UX-19 UI crash vector). So this is a component-display
  duplication, not a carry-forward re-implementation.
- The real independent preOpenCash formula lives in **alignment/page.tsx**, not multiyear.

## Q1 — Exhaustive inventory (every pre-opening/Year-0/beginning-cash derivation)
**(A) Compliant — call `computeCarryForward`:** dashboard/page.tsx:76 (Overview), scorecard:31,
advisory:107, ask:42, multiyear:35, portfolio/page.tsx:255, portfolio/[schoolId]:133,
api/scenarios/seed:52, scenarioEngine.ts:199. Plus readers of engine output / passed value:
buildSchoolContext.ts:208 (`beginningCash = multiYear[0].cumulativeNet - multiYear[0].net` —
derived from engine output, not independent), export/commission startingCash (param; caller
dashboard/page.tsx:361 passes `preOpenCash`=computeCarryForward), dashboard:494 (uses preOpenCash).

**(B) Independent re-derivation — TARGETS:**
| Site | What it does | |
|---|---|---|
| `alignment/page.tsx:77` | `computeMultiYearDetailed(..., preOpeningNet = 0, ...)` — hardcoded 0, not carryForward | DRIFT |
| `alignment/page.tsx:80-81` | `preOpenCash = Math.round(startupFunding * 0.6)` then `computeFPFScorecard(multiYear, preOpenCash)` — 60%-of-funding heuristic | DRIFT |
| `multiyear/page.tsx:38-52` | re-derives year0Total + preOpenExpenses for component display; :49-51 read raw | MATCH (+ crash risk) |
| `cashflow/page.tsx:85,162-190` | `year0Funding` + `year0EndingBalance` from LIVE editor state | editor/live-preview |

**(C) Non-cash display / labels only:** Showcase.tsx, tourSteps, StepOperations, revenue:724 — ignore.

## Q2 — multiyear (Match or Drift)
The year0Total memo (:38-48) and preOpenExpenses (:49-52) use logic IDENTICAL to
`computeCarryForward`'s internals (same year0 loop + `|| totalFunding`; same `actual>0?actual:budget`).
On canonical data the displayed components equal the engine's internals -> **MATCH** (pure dedup,
no visible change). The only defect is the RAW `pre_opening_*` reads at :49-51 (P-UX-19 hardened
the engine but explicitly deferred this UI reader to P-UX-20) — a residual crash vector on
malformed import/seed data, not a number difference.

## Q3 — Divergence #2 (the 84-vs-88 DCOH gap): VERDICT = (iii) STALE CACHE
- The RENDERED scorecard/overview/advisory/ask DCOH all derive preOpenCash from
  `computeCarryForward` (=88 on current test-columbia, per the overnight Half-A run). None reads
  the cached advisory for its DCOH.
- `src/app/api/advisory/route.ts` has **no** preOpenCash / computeFPFScorecard / scorecard
  computation (grep empty) — consistent with CLAUDE.md "agents receive pre-computed Days of Cash."
  So the cache's DCOH is whatever the client passed when generated; the route is NOT a second source.
- test-columbia `advisory_cache`: dataHash `v3-2026-05|f72d4e4c|5033`, **generatedAt 2026-05-12**,
  briefing says "84 days." That predates the **Jun-3 P-FIN-01/02 (cashOnHand/depreciation DCOH
  rework) and R-REV revenue changes** that moved live DCOH to 88.
- **Mechanism:** `computeAdvisoryHash` hashes inputs + PROMPT_VERSION but NOT engine-code version,
  so a month of engine changes shifted live DCOH 84->88 while the cache (inputs unchanged) never
  invalidated. => **stale cache**, NOT a second preOpenCash source feeding the scorecard.
- The alignment `0.6*funding` heuristic IS a genuine second source (ii) — but it feeds the
  Alignment Review scorecard, NOT the advisory cache, so it is a SEPARATE real bug, not Divergence #2.
- Confirmation experiment (clear `advisory_cache`/`advisory_data_hash` on test-columbia + recompute):
  expected to converge to 88. Costs one Anthropic call + mutates test-columbia (snapshot/restore) +
  needs the route triggered. Given the static evidence is conclusive (no independent source in the
  route; mechanism identified), I recommend running it only on your go rather than spending it now.

## Q4 — Cashflow editor: read-vs-write
WRITES `pre_opening_expenses`/`pre_opening_transactions` (:255-256) and computes
`year0EndingBalance` from LIVE useState being edited (:188-190) for the in-tab preview. Routing it
through `computeCarryForward(profile)` would show STALE saved data, defeating the live editor.
Conceptual Match on saved canonical data; **editor-path, OUT of scope** (not an import/seed crash
vector — it's the writer). Recommend: leave; optionally harden its raw reads later.

## Q5 — Per-site Match/Drift table
| Site | Current vs computeCarryForward (test-columbia) | Disposition |
|---|---|---|
| alignment scorecard preOpenCash | 0.6*350000 = **210000** vs **350000** (Δ -140000); + multiYear preOpen 0 vs 350000 | **DRIFT — correction** |
| multiyear component display | identical logic -> equal on canonical | **MATCH — dedup + crash-safety** |
| cashflow year0EndingBalance | equal on saved data | out of scope (editor) |
| advisory cache (Divergence #2) | 84 (stale) vs 88 (live) | cache invalidation, not a reroute |

## Q6 — Recommended scope + fix plan
1. **alignment/page.tsx (DRIFT, correctness fix):** `const preOpenCash = useMemo(() =>
   computeCarryForward(profile), [profile])`; pass it to BOTH `computeMultiYearDetailed` (:77,
   replacing `0`) and `computeFPFScorecard` (:83). Delete the `startupFunding` sum + `*0.6`. Visible
   change: Alignment Review scorecard DCOH/cash metrics move to the canonical value (an RFP surface).
2. **multiyear/page.tsx (MATCH, dedup + crash-safety):** two options for the checkpoint —
   (a) minimal: route the :49-51 raw reads through `canonicalizePreOpeningTransactions/Expenses`
   (crash-safe; keeps the small component duplication); OR (b) single-source: add a pure
   `computeCarryForwardBreakdown(profile): {year0Total, preOpenExpenses, carryForward}` that
   `computeCarryForward` delegates to (output byte-identical), and have the page read components
   from it. (b) is truer single-source but adds one engine helper + a no-op refactor of
   computeCarryForward; (a) is reader-only. **Recommend (b)** — it removes the duplication the rule
   targets and is provably byte-identical; needs your OK since it touches the engine file.
3. **Divergence #2:** NOT a preOpenCash reroute. Recommend a separate fix — fold an engine-version
   token into `computeAdvisoryHash` so engine changes invalidate stale advisory caches — logged as
   a backlog candidate (**P-UX-21**, verify unused). Optionally clear test-columbia's stale cache.
4. **cashflow:** out of scope (editor).
- Test: `tests/session4/carry-forward-single-source.spec.ts` — alignment now uses computeCarryForward
  (DCOH equals the Overview/scorecard value); multiyear components equal computeCarryForward internals
  + crash-safe on malformed; carry-forward pins WA 350000 / Generic 120000; four-pathway byte-identical
  on the multiyear dedup.

## Phase 1 nature
- **alignment = correctness change** (visible: Alignment Review DCOH corrects to canonical).
- **multiyear = pure dedup / crash-safety** (no visible change on canonical).
- Divergence #2 = stale cache (separate follow-up), explained here without a browser re-run.

---
**HARD STOP.** Decisions: (1) approve alignment correctness reroute (it changes a displayed DCOH);
(2) multiyear fix — option (a) reader-only crash-safe vs (b) engine breakdown helper (touches engine
file, byte-identical); (3) Divergence #2 — log P-UX-21 cache-version-invalidation (and/or clear
test-columbia's stale cache now?); (4) cashflow out of scope — confirm.
