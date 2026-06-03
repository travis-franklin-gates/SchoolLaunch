# R-REV-03 + R-REV-07 Design: custom revenue and non-personnel expense lines

Status: DESIGN ONLY. No product code, migration, engine, UI, or export change in
this session. typescript-lsp down -> grep + reads. supabase READ ONLY. This doc
ends at a decision checkpoint.

Goal: let a WA Charter applicant itemize revenue and non-personnel expense lines
the way the Commission V11 template does (V11 has ~39 non-personnel expense
sub-lines across Contracted Services / School Operations / Facility O&M; SL has
~12 abstract lines), so the Commission Excel export reads as a credible,
line-by-line budget. Both ride the same custom_*_lines JSONB pattern.

---

## D1 - Existing custom_revenue_lines (NOT unused)

The backlog said "exists but unused." That is WRONG - it is actively used by the
GENERIC pathway:
- Column: school_profiles.custom_revenue_lines, jsonb. (Confirmed present;
  1 of 25 rows populated.)
- Shape in the wild: [{ "key": "registration_fees", "label": "Registration Fees",
  "amount": 36000 }] (flat Y1 amount; no driver, no escalation, no per-year, no
  category group).
- WRITE path: onboarding StepOperations.tsx builds entries for the non-WA
  pathways and onboarding/page.tsx:476 writes profile.custom_revenue_lines. Keys
  are semantically meaningful: 'per_pupil_funding', 'registration_fees',
  'fundraising'.
- READ path: the GENERIC multi-year engine (budgetEngine.ts ~1110, a SEPARATE
  function from the WA computeMultiYearDetailed at ~536) reads customLines and
  back-computes rates: perPupilRate = per_pupil_funding.amount / enrollmentY1,
  registrationFeePerStudent = registration_fees.amount / enrollmentY1,
  baseFundraising = fundraising.amount. Also read by GenericRevenueView.tsx:24
  and onboarding/complete/route.ts:96.
- The WA pathway engine (computeMultiYearDetailed ~536) does NOT read
  custom_revenue_lines at all today.

Implication: the column is real and load-bearing for Generic, with a flat
{key,label,amount} shape that is (a) pathway-specific, (b) semantically
overloaded (key drives engine behavior), (c) missing driver/escalation/category/
per-year. The unified WA schema must be a SUPERSET that the existing generic
reader still tolerates (it only reads .key and .amount), and the WA reader must
tolerate the legacy flat shape. No new column needed for revenue (reuse this);
custom_expense_lines is a NEW column for R-REV-07.

WA isolation: because WA schools run computeMultiYearDetailed (ignores the column
today) and Generic schools run the generic engine (reads it), the same column can
hold the rich WA shape for WA schools and the legacy flat shape for Generic
schools with no runtime collision - each engine reads it on its own terms.
Generic/Private/Micro behavior stays untouched as long as we do not change the
generic reader or the keys it looks for.

---

## D2 - Driver model (critical)

WA computeMultiYearDetailed (budgetEngine.ts ~536-694) computes each existing
non-personnel line per year y (1..5) as:
- Inflation-escalator (flat-but-escalated): opsScale = opsEscalator^(y-1), where
  opsEscalator = 1 + operations_escalator (2%). Applied to facilities, insurance,
  profDev, marketing, fundraising (scale with inflation only).
- Per-pupil (x enrollment series): enrRatio = enr / enrollments[0]; supplies,
  contracted, technology, foodService, transportation, curriculum scale as
  y1Value x enrRatio x opsScale. Enrollment series = expansion-derived or
  target_enrollment_y1..y5.
- Flat: a value held constant across years (no current pure-flat ops line; the
  escalated lines are the closest analog).
- Per-FTE: NOT currently used for non-personnel ops (FTE drives personnel only,
  via positions array). A per-FTE custom driver would multiply by total FTE for
  year y (sum of positions[year==y].fte) - that series already exists in the loop
  (yearPositions / computeMultiYearPersonnel).
- Revenue COLA (the revenue analog of inflation): colaMult =
  revEscalator^(y-1), revEscalator = 1 + revenue_cola (3%). calcCommissionRevenue
  applies this to every revenue rate.

Helper / source inventory to REUSE (no duplicated math):
- enrollment series: enrollments[] (expansionToEnrollmentArray / target_*).
- FTE series: positions filtered by year, or computeMultiYearPersonnel.
- inflation: opsEscalator (expenses), revEscalator (revenue), salaryEscalator
  (personnel) from getStateConfig(pathway).
- per-pupil pattern: y1Value x enrRatio x opsScale (expenses) or rate x
  enrollment x colaMult (revenue, see calcCommissionRevenue).

FIFTH driver - "% of recurring revenue" (R-REV-07 Management Company Fee):
- Precedent EXISTS. authorizerFee = calcAuthorizerFeeCommission(stateApport,
  feeRate) is a %-of-revenue expense already computed AFTER stateApport inside the
  year loop. So a pct_revenue driver is not novel.
- Computation-order rule: a pct_revenue expense must be computed AFTER revenue
  (including custom revenue lines) is finalized for the year. Slot it in the same
  place authorizerFee sits (post-revenue, pre-totals).
- Base definition (must be explicit): "recurring operating revenue" =
  operatingRevenue (rev.total + custom RECURRING revenue), excluding one-time
  startup grants and excluding the pct_revenue expenses themselves. Because a
  pct_revenue expense never feeds back into revenue, there is NO circularity even
  with multiple pct_revenue lines - they all read the same finalized revenue base.

---

## D3 - Existing expense lines and V11 mapping

SL WA non-personnel lines (12 user-facing + 2 computed), from the WA engine and
Operations tab. User-editable (stored as budget_projections subcategories):
Facilities, Supplies & Materials, Contracted Services, Technology, Insurance,
Food Service, Transportation, Curriculum & Materials, Professional Development,
Marketing & Outreach, Fundraising. Computed: Authorizer Fee (% of state apport),
Contingency (% of expenses).

V11 itemization (RECONCILIATION_REPORT.md s2.2) - 39 sub-lines in 3 groups vs
SL's collapsed lines:
- Contracted Services: V11 9 sub-lines vs SL 1 ("Contracted Services").
  Cited names: Nurse Services ($43K), SPED Services ($264K), Titlement Services
  ($53K), Management Company Fee, Legal, Payroll [+ ~3 not enumerated in report].
- School Operations: V11 22 sub-lines vs SL ~8 (Supplies, Technology, Curriculum,
  ProfDev, Marketing, Fundraising, Insurance, Food Service mapped loosely).
  Cited names: Board Expenses, Stipends/Bonuses, Extra Curricular, Student
  Recruitment/Marketing, Office Expense, Staff Recruitment [+ more not enumerated].
- Facility O&M: V11 8 sub-lines vs SL ~2 (Facilities). Cited names: Janitorial
  ($36K), Repairs/Maintenance ($18K), Security ($22K), Utilities ($48K),
  Equipment, Other [+ more].

OUT OF SCOPE for R-REV-07 (separate backlog P-FIN-01 / P-FIN-02): Depreciation
($172K/yr) and Interest Expense ($257K->240K/yr). These need a facility-debt
model, not line itemization. Do not fold them into custom_expense_lines.

The complete 39-name list is NOT fully spelled out in the report (only
representative names). Source of record for the full enumeration:
tests/audit/v11-cedar-grove/session2/scripts v11_values.json (and the V11
workbook). The implementation should pull exact names from there; this design
does not invent the remainder.

---

## D4 - Commission Excel export structure

src/app/api/export/commission/route.ts:
- READS the multiYear rows passed in the request body (computed client-side via
  computeMultiYearDetailed). It does NOT recompute. Good - matches the
  single-source-of-truth constraint.
- REVENUE tab (~224): one hardcoded row per known revenue field, e.g.
  ['8.1','State Categorical','LAP High Poverty','Per Pupil',0,
   ...multiYear.map(r => r.revenue.lapHighPoverty)]. Columns: # / Source /
  Description / Driver / Year0..Year5. Total Revenue = r.revenue.total.
- P&L tab (~273): NON-PERSONNEL EXPENSES section, one hardcoded row per ops field,
  e.g. ['Facilities',0,...multiYear.map(r => r.operations.facilities)],
  Supplies, Contracted, Technology, Authorizer Fee, Insurance, [Food Service,
  Transportation, Curriculum, ProfDev, Marketing, Fundraising, Contingency below].
- Grouping is by the hardcoded Source/section labels.

To thread custom lines as itemized rows: the export must iterate the custom
revenue/expense arrays under their category group. Cleanest: the engine emits
per-year custom-line breakdowns on each MultiYearDetailedRow (row.customRevenue[],
row.customExpense[], each { id, name, group, amounts-by-year }); the export just
iterates and inserts rows under the matching group header. Export stays a pure
reader.

---

## D5 - FPF / scorecard interaction

computeFPFScorecard (budgetEngine.ts:839) reads per-row totals:
- yearEndCash from row.net; Current Ratio from row.totalExpenses; Days of Cash
  from (row.totalExpenses - depreciation)/365; Total Margin from row.net /
  row.revenue.operatingRevenue.

So custom lines hit the scorecard AUTOMATICALLY provided the year loop folds them
into the row totals BEFORE net is computed:
- Custom RECURRING revenue -> add into operatingRevenue (the Total Margin
  denominator). Custom ONE-TIME revenue -> add into totalRevenue/non-operating
  only (NOT operatingRevenue), same treatment as startup grants, so Total Margin
  is not inflated by one-time money. This requires a `recurring` flag on revenue
  lines (ties to R-REV-04 CSP semantic).
- Custom expense -> add into totalOperations -> totalExpenses -> net.
No separate scorecard plumbing is needed; the plumbing is "fold into the existing
row totals inside computeMultiYearDetailed." Emit the per-line breakdown on the
row purely for the export.

---

## D6 - Pre-seed vocabulary (for approval; sources cited, no invented codes)

REVENUE pre-seed (R-REV-03), from SESSION_1_GAPS.md s4 / V11 INPUTS R41-R76:
- Title II (Federal, ~$36/pupil, teacher quality)
- Title III (Federal, ~$23/pupil, English Language Acquisition)
- State Food Service (OSPI 4198, ~$23/pupil; distinct from federal NSLP already
  modeled)
- Transportation Operations (OSPI 4199, ~$595/pupil) [revenue side]
- OSPI Special Purpose Unassigned (6100; catch-all OSPI grants)
- Sale of Goods/Supplies/Services (2200)
- SPED General Apportionment (3121) - only if we split it from 4121 State SPED
  (verify before seeding; may be a rename not a new line)
- CSP recurring portion - depends on R-REV-04 recurring-vs-startup decision
  (recurring CSP would live here; one-time CSP stays in startup_funding)

EXPENSE pre-seed (R-REV-07), grouped, from RECONCILIATION_REPORT.md s2.2:
- Contracted Services group: Nurse Services, SPED Services, Titlement Services,
  Management Company Fee (pct_revenue driver), Legal, Payroll Services [+ remainder
  from v11_values.json]
- School Operations group: Board Expenses, Stipends/Bonuses, Extra Curricular,
  Student Recruitment/Marketing, Office Expense, Staff Recruitment [+ remainder]
- Facility O&M group: Janitorial, Repairs/Maintenance, Security, Utilities,
  Equipment, Other [+ remainder]
Full 39-name enumeration to be pulled from v11_values.json at implementation;
NOT invented here.

---

## PROPOSED DESIGN + open decisions

### DEC-1 Schema/UX model - RECOMMEND: free-form JSONB + pre-seed picklist
One JSONB array per kind (revenue, expense), with a curated picklist of common WA
Charter / V11 line names (D6) plus an "add custom" affordance. Rationale: ~39
expense + ~7 revenue lines as first-class typed columns is untenable (schema
bloat, migration churn, validation cost); JSONB + picklist is one pattern for both
kinds, reviewer-legible via the curated names, and matches the existing
custom_revenue_lines column. Reject the typed-fields alternative.

### DEC-2 Unified line schema - RECOMMEND (superset, back-compatible)
type CustomLine = {
  id: string                 // stable id (uuid). Legacy generic entries carry `key` instead.
  name: string               // display label. Legacy entries carry `label`.
  group: string              // category group (revenue: 'State Categorical'|'Federal'|
                             //  'Program Revenue'|'Other'; expense: 'Contracted Services'|
                             //  'School Operations'|'Facility O&M')
  driver: 'per_pupil' | 'per_fte' | 'flat' | 'inflation' | 'pct_revenue'
  amountY1: number           // base Y1 dollar amount (flat/inflation/explicit). Legacy `amount`.
  rate?: number              // per_pupil ($/student), per_fte ($/FTE), pct_revenue (percent)
  escalation?: number | null // optional escalator override; else config default by kind
  recurring?: boolean        // REVENUE only: true -> operatingRevenue; false -> non-operating. Default true.
  perYearOverrides?: Record<number, number> | null  // optional explicit Y1-Y5 dollar overrides
}
- Same shape for revenue and expense. Sign differs (revenue adds to revenue
  totals, expense adds to expense totals); category vocab differs by kind.
- Back-compat: readers treat name = name ?? label, base = amountY1 ?? amount, and
  ignore unknown fields (P-UX-11 robustness lesson). The Generic engine, which
  only reads `key` and `amount`, is untouched.
- Reuse custom_revenue_lines for revenue; add custom_expense_lines (new column,
  jsonb default '[]') for expense.

### DEC-3 Driver set - RECOMMEND: confirm the five
per_pupil (rate x enrollment series), per_fte (rate x FTE series), flat (constant),
inflation (amountY1 x escalator^(y-1)), pct_revenue (rate% x recurring operating
revenue). Ordering: compute base + custom revenue first -> operatingRevenue; then
non-pct expenses; then pct_revenue expenses last (same slot as authorizerFee),
reading the finalized recurring revenue base. No circularity.

### DEC-4 Build sequencing - RECOMMEND: R-REV-03 first, then R-REV-07
R-REV-03 (revenue) first: reuses the existing column (no migration to start),
establishes the shared CustomLine type + editor component + engine threading +
export threading + FPF inclusion. R-REV-07 (expense) second: adds the
custom_expense_lines migration, the expense category vocab, the pct_revenue driver,
and the Management Company Fee. Implementation prompt sub-phases (each kind):
(a) shared types, (b) migration [expense only], (c) engine threading in
computeMultiYearDetailed (fold into totals + emit per-line breakdown),
(d) editor UI (Revenue tab for R-REV-03 / Operations tab for R-REV-07),
(e) export threading (itemized rows under group headers), (f) FPF + regression
tests (incl. a Cedar Grove itemization fixture).

### DEC-5 FPF inclusion - RECOMMEND
Fold custom recurring revenue into operatingRevenue and custom expense into
totalOperations inside the computeMultiYearDetailed year loop, before net. One-time
custom revenue goes to non-operating only. Scorecard then updates automatically (it
reads row totals). Emit row.customRevenue[]/row.customExpense[] for the export only.

### DEC-6 Pre-seed vocabulary - SEE D6 (await approval)
Revenue list and the three expense groups above. Full 39 expense names to be pulled
from v11_values.json at implementation, not invented here.

### Cross-cutting flags
- recurring flag (DEC-2) intersects R-REV-04 (CSP recurring vs startup). Resolve
  R-REV-04 semantics before seeding any CSP recurring revenue line.
- 3121 SPED separation may be a rename of existing State SPED, not a new line -
  verify before seeding (avoid double-count).
- Depreciation / interest are explicitly OUT (P-FIN-01/02), not custom_expense_lines.
