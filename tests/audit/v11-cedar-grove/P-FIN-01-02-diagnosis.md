# P-FIN-01 / P-FIN-02 - Phase 0 Diagnosis

Facility depreciation (P-FIN-01) + facility debt interest (P-FIN-02) for owned/financed
WA Charter facilities. Read-only diagnosis. No code, no schema change. Checkpoint follows.

Date: 2026-06-03. Engine reference: `src/lib/budgetEngine.ts` (computeMultiYearDetailed
@487, computeFPFScorecard @898). Custom-line pattern reference: `src/lib/customLines.ts`.

---

## D1 - DCOH denominator (the delicate one) + a numerator finding the candidate doc misses

### Current SchoolLaunch DCOH (computeFPFScorecard, lines 937-959)

```
const depreciation = 0 // no depreciation modeled in planning mode
const daysOfCash = multiYear.map((row, i) => {
  const dailyExpense = (row.totalExpenses - depreciation) / 365
  return dailyExpense > 0 ? Math.round(yearEndCash[i] / dailyExpense) : 0
})
```

- **Denominator:** `(row.totalExpenses - depreciation) / 365`. `depreciation` is hardcoded
  `0` today, but the formula is ALREADY structured to subtract it. `row.totalExpenses`
  = `totalPersonnel + totalOperations` (line 719); it does NOT currently exclude any
  non-cash item (there are none today).
- **Numerator (`yearEndCash[i]`):** built at lines 903-909 as
  `startingCash + cumulative sum of row.net`, where `row.net = totalRevenue -
  totalExpenses` (line 721). So the numerator is **cumulative net income treated as
  cash** - today cash == net income because every expense is a cash expense.

### V11's DCOH formula (RECONCILIATION_REPORT.md s5.4)

`Unrestricted Cash / ((Total Expenses - Depreciation) / 365)`

- V11 self-reports DCOH Y1 = 102.63 days; our recompute with depreciation=0 gives 92.
  The ~11-day gap IS the depreciation exclusion.
- **Interest is IN V11's denominator.** Interest Expense is P&L row 271 (a normal expense
  line, `v11_values.json` interest_expense.y1 = 257,016.07); it is part of "Total
  Expenses" and is NOT subtracted out. Only depreciation (row 272, non-cash) is
  subtracted. **Confirmed against V11, not assumed.** Firm rule holds: depreciation
  excluded as non-cash; interest follows V11 = stays IN.

### THE ENTANGLEMENT the candidate doc does not address (surprise-prone finding)

The candidate doc (SESSION_2_BACKLOG_CANDIDATES.md P-FIN-01 step 4) says only "subtract
depreciation from the DCOH denominator." **That is necessary but NOT sufficient** to
produce the behavior this build's own Phase 2 asserts ("a school WITH depreciation has
the SAME DCOH as without it").

Reason: if depreciation is folded into `totalExpenses`, it also flows through
`net -> cumulativeNet -> yearEndCash`, i.e. it **reduces the cash numerator**. Depreciation
is non-cash; it must NOT reduce cash. Subtracting it from the denominator alone leaves
the numerator wrongly depressed, so DCOH would still drop. To make depreciation truly
DCOH-neutral, depreciation must ALSO be **added back to the cash numerator** (standard
cash-flow add-back of a non-cash charge).

Algebraic proof the add-back is exactly neutral (let subscript 0 = no financing):

- No financing: `cash0 = Sum(net0)`, `denom0 = totalExp0/365`.
- Add depreciation D (per year), with add-back:
  - `net = net0 - D`; `totalExp = totalExp0 + D`.
  - numerator `cash = Sum(net0 - D) + Sum(D) = Sum(net0) = cash0`  (add-back cancels)
  - denominator `= (totalExp0 + D - D)/365 = totalExp0/365 = denom0`
  - => **DCOH identical.** First Phase-2 assertion satisfied.
- Add interest I (cash cost, no add-back):
  - `net = net0 - I`; `totalExp = totalExp0 + I`.
  - numerator `cash = Sum(net0 - I) = cash0 - Sum(I)`  (lower)
  - denominator `= (totalExp0 + I - 0)/365`  (higher)
  - => **DCOH lower** on both counts. Second Phase-2 assertion satisfied.

So the correct DCOH treatment is a **pair**: subtract depreciation from the denominator
AND add depreciation back to the cash numerator. The doc named only the first half. This
is resolvable and consistent with the build's stated intent - flagged at the checkpoint,
not a build-blocker, but the build MUST implement both halves or its own DCOH assertion
fails.

### Knock-on: engine `reserveDays` and "Cumulative Net Position"

- `reserveDays` (engine row field, line 725) = `cumulativeNet / (totalExpenses/365)` -
  uses the FULL expense base (does NOT subtract depreciation) and the un-added-back
  cash. With financing this would diverge from the Scorecard's DCOH. **Sub-decision at
  checkpoint:** align `reserveDays` with the corrected FPF DCOH (recommended, for
  Multi-Year/Overview consistency) or leave as-is.
- "Cumulative Net Position" export row (cumulativeNet) is an ACCRUAL/net-assets concept
  and SHOULD fall with depreciation. So `cumulativeNet` stays accrual; the cash add-back
  lives only in the DCOH/reserve-days numerator, computed from emitted per-year
  depreciation. This keeps net-assets accrual-correct and cash-metrics cash-correct.

---

## D2 - Existing facility / lease handling (no owned-vs-lease concept today; additive, no double-count)

- SchoolLaunch has **no owned-vs-lease concept**. The only facility line is the
  Operations subcategory **"Facilities"** (`y1Ops('Facilities')`, line 524 ->
  `facilities` @683), which is the lease/rent/building operating cost. It scales by
  opsEscalator only.
- Depreciation and interest are **ownership** costs and are NEW, independent lines - they
  are NOT derived from the Facilities lease line, so there is no double-count. A school
  typically has one or the other (lease vs own), but they coexist additively with no
  overlap (e.g. lease part of a space + own an improvement).
- Custom-expense double-count is also already ruled out: `customLines.ts` lines 169-171
  explicitly EXCLUDE "Interest Expense and Depreciation (P-FIN-01/02)" from the R-REV-07
  expense presets. No overlap with custom expense lines.
- **Conclusion:** additive design is safe; no facility concept conflicts with it. No
  surprise-stop trigger from D2.

---

## D3 - Schema fit: one `facility_financing` jsonb on `school_profiles`

Recommended single object (mirrors financial_assumptions / custom_expense_lines /
startup_funding JSONB patterns; SchoolProfile @125, jsonb fields @141-148):

```jsonc
facility_financing: {
  // depreciation (P-FIN-01)
  basis: number,            // building/improvement cost basis ($)
  useful_life: number,      // years, default 30
  // loan (P-FIN-02)
  principal: number,        // loan principal ($)
  interest_rate: number,    // annual %, e.g. 5
  term_years: number,       // amortization term, e.g. 30
  start_year: number,       // projection year financing begins (default 1)
} | null
```

- `basis` (depreciation) and `principal` (loan) are **INDEPENDENT** inputs even though
  Cedar Grove's $5.175M happens to be both. A school could own outright (basis, no loan)
  or finance an asset it depreciates on a different basis.
- Default = absent/null => depreciation 0, interest 0 => byte-identical to today.
- Fits existing JSONB conventions; no new table; additive column with default none.

---

## D4 - P&L / Operations splice points

### Engine (computeMultiYearDetailed)

- Compute inside the year loop (`for y=1..5`), in the same slot as the R-REV-07 custom
  expense fold (after contingency @717), so contingency base stays byte-identical:
  - `depreciation_y = (y >= start_year && basis > 0) ? round(basis / useful_life) : 0`
    (constant straight-line).
  - `interest_y = monthly fully-amortizing schedule, summed over loan-year (y -
    start_year + 1); 0 if no loan or y < start_year`.
  - `totalOperations += depreciation_y + interest_y` (AFTER contingency + custom
    expense). `totalExpenses = totalPersonnel + totalOperations` then includes both.
- **Emit per-year** `row.operations.depreciation` and `row.operations.interest`
  (new fields on MultiYearDetailedRow.operations @456-473) so FPF and export are pure
  readers (single source of truth - same discipline as customExpense).

### computeFPFScorecard

- Denominator: `(row.totalExpenses - row.operations.depreciation) / 365` (interest stays
  in via totalExpenses).
- Numerator: build `yearEndCash` as `startingCash + Sum(row.net + row.operations.
  depreciation)` (depreciation add-back). See D1 proof.

### Operations UI

- New "Facility Financing (if applicable)" section with inputs: basis, useful_life
  (default 30), principal, interest_rate, term_years, start_year (default 1); plus
  read-only computed depreciation + interest per year. Placed inside the EXISTING P-UX-17
  hydration guard already on the Operations page (page.tsx @102-108, `hydrated` gate) -
  the guard keys on `loading`/`profile`, so adding facility_financing to the same gate
  covers it. Confirmed the guard pattern fits the new inputs.

### Export (commission/route.ts P&L)

- Two pure-reader rows "Facility Depreciation" and "Facility Interest" inserted before
  "Total Non-Personnel" (same splice technique as customExpense @353-370). Only inserted
  when values are present, preserving byte-identical export for lease schools.

---

## D5 - Amortization method: V11 uses a MONTHLY fully-amortizing schedule (CONFIRMED byte-exact)

V11 per-year interest (`v11_values.json` interest_expense, P&L row 271, from INPUTS!E160:I160):

| Year | V11 interest |
|------|-------------:|
| Y1 | 257,016.07125742125 |
| Y2 | 253,109.85234050342 |
| Y3 | 249,003.78385025455 |
| Y4 | 244,687.64110321214 |
| Y5 | 240,150.6763017025 |

Reproduced a standard monthly fully-amortizing loan (P=5,175,000, 5%/yr, 360 months,
monthly payment $27,780.52, annual interest = sum of 12 monthly interest charges):

| Year | computed | V11 | delta |
|------|---------:|----:|------:|
| Y1 | 257,016.07 | 257,016.07 | 0.00 |
| Y2 | 253,109.85 | 253,109.85 | 0.00 |
| Y3 | 249,003.78 | 249,003.78 | 0.00 |
| Y4 | 244,687.64 | 244,687.64 | 0.00 |
| Y5 | 240,150.68 | 240,150.68 | 0.00 |

**Byte-exact match.** The candidate doc's `remaining_principal x rate` (annual-balance)
would give ~258,750 Y1 (P x 5%, no in-year paydown), a ~$1.7K/yr overstatement that
diverges from V11. **Recommendation: replicate the monthly schedule** (exact V11
reconciliation, full credibility). Depreciation: V11 = 172,500/yr flat = 5,175,000/30,
confirmed straight-line `basis/useful_life`.

---

## Surprise-stop assessment

- D2 does NOT contradict the additive design (no conflicting facility concept). No abort.
## Phase 1 as-built addendum (discovered during implementation)

The D1 "cumulativeNet is treated as cash" leak runs DEEPER than the DCOH numerator. Interest
INCOME is computed on `priorCash = cumulativeNet` (budgetEngine.ts year loop). Because
depreciation (non-cash) lowers cumulativeNet, it spuriously lowered interest income in later
years, so a dep-only school's net dropped by MORE than depreciation (Cedar-Grove-like test:
Y2 delta 20,600 vs the 20,000 depreciation) and DCOH was NOT depreciation-neutral - the
approved assertion failed. Fix (necessary for the approved both-halves behavior, and the same
root cause already greenlit): the interest-income base also adds back accumulated depreciation
(`priorCash = cumulativeNet + cumulativeDepreciation`). 0 for lease schools => byte-identical.
This was the only change beyond the literal checkpoint enumeration; flagged here and at sign-off.

Sub-decision resolved as approved: ONE shared `computeDaysOfCash(endingCash, totalExpenses,
depreciation)` helper now backs BOTH the FPF Scorecard DCOH and the engine `reserveDays`
(extraction was clean and byte-identical for no-financing schools, so no backlog candidate
needed). `cumulativeNet` / "Cumulative Net Position" stays accrual (no add-back there).

Follow-up (approved + built): ALL cash-derived scorecard surfaces now route through ONE
cash figure (`cashOnHand` = startingCash + cumulative(net + depreciation)) so they cannot
disagree: Current Ratio, Days of Cash, Cash Flow, and Multi-Year Cash Flow. Current Ratio's
denominator also excludes depreciation (monthly CASH expenses), making it depreciation-
neutral like DCOH. Byte-identical for lease schools (zero add-back). Verified on real
test-columbia data: depreciation-only leaves Current Ratio / Cash Flow / DCOH unchanged;
interest lowers them.

## Surprise-stop assessment (recorded at checkpoint)

- D1 reveals the FPF/DCOH interaction IS more entangled than the candidate doc implies
  (doc named only the denominator subtraction; the cash-numerator add-back is also
  required to satisfy the build's own DCOH assertion). This is **resolvable and
  consistent with stated intent** - surfaced at the checkpoint with a concrete fix, not
  a build-blocker. Per the prompt, the checkpoint is a HARD STOP regardless; awaiting
  decisions before any code or migration.
