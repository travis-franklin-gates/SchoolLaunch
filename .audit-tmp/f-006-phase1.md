# F-006 — Phase 1 Diagnosis (Operating Revenue Inconsistency)

**Date:** 2026-05-11
**Status:** Phase 1 complete (diagnosis only). Awaiting Travis greenlight before Phase 2 code.

---

## Root cause located

**Two distinct functions both define a variable named `operatingRevenue`, and they compute different totals:**

### Path A — `computeSummaryFromProjections` (`budgetEngine.ts:139–173`)

```ts
let operatingRevenue: number
if (revenueProfile) {
  const sse = calcSmallSchoolEnhancementFromGrades(...)
  const rev = calcCommissionRevenue(...)
  operatingRevenue = rev.total
} else {
  operatingRevenue = projections.filter(p => p.is_revenue).reduce(...)
}
const totalRevenue = operatingRevenue + grantRevenue
```

- `operatingRevenue = rev.total` from `calcCommissionRevenue`
- `rev.total` includes: Regular Ed, SPED Apportionment, State SPED, Levy Equity, Facilities, Title I, IDEA, LAP, LAP HP, TBIP, HiCap, Food Service NSLP, Transportation revenue, SSE
- **Does NOT include Interest income** (that's a runtime cash-balance derivative, not in `calcCommissionRevenue`)
- This `operatingRevenue` = $1,076,886 for Evergreen Y1

### Path B — `computeMultiYearDetailed` (`budgetEngine.ts:534–712`)

```ts
const interestRate = assumptions.interest_rate_on_cash / 100
// ...
const interestIncome = y === 1
  ? Math.round(Math.max(0, priorCash) * interestRate / 2)  // half-year
  : Math.round(Math.max(0, priorCash) * interestRate)
// ...
const operatingRevenue = rev.total + interestIncome
// ...
return {
  revenue: {
    interestIncome,
    grantRevenue: yearGrantRevenue,
    operatingRevenue,        // = rev.total + interestIncome  
    total: totalRevenue,
    // ...
  },
  // ...
}
```

- Line 553 explicitly does `rev.total + interestIncome` and calls that `operatingRevenue`
- Returns `revenue.operatingRevenue` = **rev.total + interestIncome** = $1,080,636 for Evergreen Y1
- The same struct also has a separate `interestIncome` field (line 686) for downstream consumers — but the conflated `operatingRevenue` is what most surfaces read

**The two `operatingRevenue` variables disagree by exactly the Y1 interest income ($3,750 for Evergreen with $250K Y0 startup).**

---

## Surface read paths

| Surface | Function consumed | Y1 value | Includes Interest? |
|---|---|---|---|
| Revenue tab (Operating Revenue + Total Revenue rows) | `calcCommissionRevenue` directly via Revenue page logic | **$1,076,886** | NO |
| Overview Personnel % tile denominator | `baseSummary.operatingRevenue` from `computeSummaryFromProjections` | **$1,076,886** | NO (correct per accounting convention) |
| Overview Y1 trajectory strip / Y1 Base Case summary | `multiYear[0].revenue.total` (which sums operatingRevenue+grant) | **$1,080,636** | **YES** |
| Multi-Year tab Operating Revenue row | `multiYear[N].revenue.operatingRevenue` | **$1,080,636** | **YES** |
| Cash Flow Y1 monthly apportionment | Direct from `calcCommissionRevenue` × monthly schedule | (matches Revenue tab) | NO |
| AI context (`buildSchoolContext.ts:175-185`) | `operatingRevenue = rev.total` (Path A style) | $1,076,886 | NO (consistent with tile) |
| PDF export | TBD — likely mixed | TBD | TBD |
| Excel export | TBD — likely mixed | TBD | TBD |

**Internal inconsistency on the Overview page itself:**
- Personnel % tile uses $1,076,886 as denominator (correct accounting)
- Y1 trajectory strip / Y1 Base Case summary card shows $1,080,636 (includes Interest)
- These two values appear on the same page within ~200px of each other.

---

## Recommended fix shape

### Option (A) — Rename and split (recommended)

In `computeMultiYearDetailed`:

```ts
// Before (line 553):
const operatingRevenue = rev.total + interestIncome
// ...
operatingRevenue,    // misleading

// After:
const operatingRevenue = rev.total                 // rename: excludes non-operating
const totalRevenue = operatingRevenue + interestIncome + yearGrantRevenue
// ...
operatingRevenue,    // now actually operating
totalRevenue,        // distinct field, includes everything
```

Then in Multi-Year UI:
- Add a new row: "Operating Revenue" (excludes Interest, matches Revenue tab)
- Add a new row: "Total Revenue" (includes Interest + Grants)
- Update the Y1 Base Case Operating Revenue line on Overview to use the new `operatingRevenue` value

**Result:**
- Operating Revenue = $1,076,886 across Revenue tab, Overview tile denominator, Multi-Year row, Overview Y1 strip
- Total Revenue = $1,080,636 across Multi-Year, Overview Y1 strip total
- Two distinct concepts, two distinct labels, single source of truth for each

### Option (B) — Keep "operatingRevenue" name in both functions, fix the semantics

Less invasive: make `computeMultiYearDetailed`'s `operatingRevenue` field exclude Interest. Multi-Year UI's "Operating Revenue" row reads that field directly.

```ts
// Line 553 change to:
const operatingRevenue = rev.total
const totalRevenue = operatingRevenue + interestIncome + yearGrantRevenue
```

Multi-Year UI consumers who currently read `revenue.operatingRevenue` would automatically get the correct value. UI labels stay the same.

**Risk:** If any downstream code adds interest separately expecting `operatingRevenue` to already include it, that code will break silently. Need to grep all consumers of `revenue.operatingRevenue` before flipping.

### Recommendation: Option (B) for May 19

Smaller blast radius. Same end-state. The "Operating Revenue" label across surfaces will then mean the same thing.

---

## Decisions to surface to Travis

### D1 — Fix shape

- (A) Rename + split fields (clearer but bigger refactor)
- (B) Fix semantics under existing name (smaller change, label stays "Operating Revenue")
- Recommendation: **(B) for May 19**, with a comment explaining the deliberate exclusion of Interest.

### D2 — Where does Interest go on Multi-Year?

Currently Multi-Year shows:
```
... existing 13 revenue lines ...
Interest & Other Income: $3,750 / $8,857 / ...
Operating Revenue: $1,080,636 / ...
Total Revenue: $1,080,636 / ...
```

The "Interest & Other Income" line exists separately, but it's being double-counted into "Operating Revenue" (which equals Total Revenue here because Grants are $0). After Option (B) fix:

```
... existing 13 revenue lines ...
Operating Revenue: $1,076,886 / ...        # NEW: excludes interest
Interest & Other Income: $3,750 / ...      # already exists
Total Revenue: $1,080,636 / ...            # = Operating + Interest + Grants
```

Decision: add the new "Operating Revenue" row between the 13 lines and the Interest line. Total Revenue stays at the bottom.

### D3 — Cross-cutting verification scope

After the fix:
- Revenue tab "Operating Revenue" = $1,076,886
- Multi-Year "Operating Revenue" Y1 = $1,076,886 (match)
- Multi-Year "Total Revenue" Y1 = $1,080,636
- Overview Y1 Base Case Operating Revenue card = $1,076,886 (match Revenue tab)
- Overview Y1 trajectory strip total = $1,080,636 (matches "Total Revenue")
- Personnel % tile denominator = $1,076,886 (already correct)

This is a one-line code change with cascading display effects. Phase 2 will need to verify each surface explicitly.

### D4 — Naming convention for downstream code

After the fix, the rule becomes:
- `operatingRevenue` = "earned from school operations" (rev.total, includes SSE / Food Service / Transportation)
- `totalRevenue` = "everything" (Operating + Interest + Grants)

Document this in a one-paragraph comment at the top of `computeMultiYearDetailed`. Future readers should not have to grep to know which means which.

### D5 — Test coverage

Existing tests:
- `tests/session4/revenue-integrity.spec.ts` covers SSE and rev.total invariants
- No test for the "Operating Revenue includes/excludes Interest" question

**Phase 2.4 test additions:**
- Unit test: `computeMultiYearDetailed` returns `revenue.operatingRevenue` = `rev.total` (no Interest), `revenue.total` = `operatingRevenue + interestIncome + grantRevenue`
- Cross-surface invariant test: for any school in `planning` status, Revenue tab Operating Revenue should equal Multi-Year Operating Revenue Y1 — exactly. No tolerance.

---

## Regression surface map

| Surface | Current Y1 display | Post-fix Y1 display | Delta |
|---|---|---|---|
| Revenue tab Operating Revenue | $1,076,886 | $1,076,886 | unchanged |
| Multi-Year Operating Revenue | **$1,080,636** | **$1,076,886** | -$3,750 |
| Multi-Year Total Revenue (new row) | — (was conflated) | $1,080,636 | new |
| Overview Y1 Base Case "Operating Revenue" | **$1,080,636** | **$1,076,886** | -$3,750 |
| Overview Y1 trajectory strip (label TBD) | $1,080,636 | $1,080,636 | unchanged (labeled "Total Revenue") |
| AI agent context | $1,076,886 (per `buildSchoolContext.ts:175`) | unchanged | none |
| Days of Cash / Reserve days / Personnel % | — (all use the smaller value, which is now consistent) | unchanged | none |
| Total Margin % | currently `net / revenue.operatingRevenue` (the conflated value) | needs re-grep — may change | check |
| FPF Scorecard Y1 Total Margin | per Phase 1 / Tab 11 was 4.2% — must verify | tbd | check |

**The Total Margin trip-wire:** Total Margin = Net ÷ Operating Revenue. After fix, if Total Margin's denominator changes from $1,080,636 to $1,076,886, the Y1 Total Margin will recompute very slightly (≈ 4.20% → 4.21%). For the audit's healthy school, this is cosmetic. For a marginal school, it could flip a Stage 1 boundary cell from "fails" to "meets" or vice versa. **Phase 2 must verify the FPF Scorecard Y1 Total Margin denominator and confirm whether Stage 1 thresholds re-evaluate.**

---

## STOP — awaiting greenlight

When greenlit, Phase 2 will:
1. Make the one-line change at `budgetEngine.ts:553` (Option B)
2. Add a "Operating Revenue (excludes Interest)" row to Multi-Year tab between the 13 revenue lines and the Interest line
3. Verify Total Margin denominator across all consumers (Scorecard, Personnel %, AI context) — confirm all use the corrected Operating Revenue OR the explicit Total Revenue per intent
4. Re-render Evergreen audit screenshots showing $1,076,886 across all surfaces
5. Add the regression invariant test
6. Update the comment block at the top of `computeMultiYearDetailed`

No code touched tonight.
