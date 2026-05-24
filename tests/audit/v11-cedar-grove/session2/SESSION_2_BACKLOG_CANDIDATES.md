# Session 2 — Candidate BACKLOG entries

Three platform issues surfaced during the V11 Cedar Grove reconciliation that don't map cleanly to any existing BACKLOG.md entry. Listed here in the same format Travis uses in BACKLOG.md; promotion into BACKLOG.md is Travis's call. None of these block Session 2 closure — Cedar Grove reconciles fine with them documented as gaps.

---

### P-FIN-01 · Facility depreciation modeling for owned-building charters
**Status:** `OPEN` (candidate) · **Source:** V11 Cedar Grove validation, Session 2

Cedar Grove's V11 carries $172,500/yr in depreciation expense from its $5.175M facility financing modeled over a 30-year amortization. SchoolLaunch's WA Charter pathway has **no depreciation field** anywhere in the data model:

- Not in `school_profiles.financial_assumptions` JSONB
- Not in `budget_projections` (no Operations subcategory for Depreciation)
- Not in the dashboard Operations UI

Any WA charter applicant who **owns** rather than leases their building cannot model depreciation in SchoolLaunch today. For Cedar Grove this is $172K/yr × 5 years = **$862K of expense the SchoolLaunch model is missing.** This also flows through to the FPF DCOH calculation: V11's DCOH formula subtracts depreciation from the denominator, so the platform produces a DCOH that disagrees with V11's by ~11 days in Y1 (and more in later years where ownership amortization compounds with cash growth).

**Proposed fix (Phase 1):**

1. Add `depreciation_annual` to `school_profiles.financial_assumptions` (default 0).
2. Add an Operations tab section "Facility Ownership (if applicable)" with two inputs: building basis ($) and useful life (years, default 30). Compute depreciation = basis ÷ life.
3. Pipe through `computeMultiYearDetailed` as an expense subtotal.
4. Update `computeFPFScorecard` to subtract depreciation from the DCOH denominator (matches V11 and the published OSPI formula).

**Proposed fix (Phase 2, optional):**

Replace the simple straight-line approach with a `facility_capital_assets` JSONB column supporting multiple assets, each with basis/useful-life/in-service-date. Most schools won't need this, but a co-location school with multiple capital improvements would.

**Reference:** `tests/audit/v11-cedar-grove/session2/RECONCILIATION_REPORT.md` §2.3, V11 INPUTS R161 / P&L R272.

---

### P-FIN-02 · Facility debt service / interest-expense modeling
**Status:** `OPEN` (candidate) · **Source:** V11 Cedar Grove validation, Session 2

Companion to P-FIN-01. Cedar Grove's V11 amortizes a $5.175M facility loan at 5% over 30 years, producing **interest expense of $257,016 Y1 declining to $240,151 Y5** ($1.24M cumulative over 5 years). SchoolLaunch has no facility-debt model and no interest-expense field. Same gap as depreciation: any applicant financing their facility cannot represent this expense.

**Proposed fix (Phase 1):**

1. Add `facility_debt` JSONB to `school_profiles` supporting a single facility loan with fields: `principal`, `interest_rate`, `term_years`, `start_year`.
2. Compute annual interest as declining-balance amortization: `interest_y = remaining_principal × interest_rate`.
3. Surface as a `budget_projections` Operations subcategory "Facility Interest" with the computed value per year.
4. Render in the Operations tab as a read-only computed line under a new "Facility Financing" sub-section.

**Proposed fix (Phase 2):**

Support multiple loans (e.g., construction loan + permanent financing). Most applicants won't need this initially.

**Combined impact (P-FIN-01 + P-FIN-02).** Cedar Grove's V11 carries $429K Y1 of facility-related expense ($172.5K dep + $257K interest) that SchoolLaunch can't model. Cumulative 5-year: ~$2.1M. This is the single largest contributor to the SchoolLaunch-vs-V11 expense gap in this reconciliation.

**Reference:** `tests/audit/v11-cedar-grove/session2/RECONCILIATION_REPORT.md` §2.3, V11 INPUTS R160 / DEBT tab / P&L R271.

---

### R-REV-07 · Non-personnel expense line-type itemization
**Status:** `OPEN` (candidate) · **Source:** V11 Cedar Grove validation, Session 2

Cedar Grove's V11 itemizes non-personnel expenses across **39 sub-lines** in three groups (Contracted Services 9 sub-lines, School Operations 22 sub-lines, Facility O&M 8 sub-lines). SchoolLaunch's WA Charter pathway has **12 abstract per-student or flat-rate lines** across the same conceptual scope.

The dollar gap can be closed by entering Cedar Grove's category totals as overrides on SchoolLaunch's existing lines (D2 fixture-fidelity). But the **itemization** isn't representable in SchoolLaunch — and the itemization is what a Commission reviewer expects to see.

Specific V11 lines absent from SchoolLaunch:

**Contracted Services (V11 group):**
- Accounting / Audit — distinct from "Contracted Services" general
- Legal — distinct line
- Management Company Fee — % of recurring revenue driver
- Payroll Services — Per-FTE driver
- Nurse Services — Per-Pupil (Cedar Grove $43.2K Y1)
- Special Ed Services — Per-Pupil (Cedar Grove $264K Y1)
- Titlement Services — Per-Pupil (Cedar Grove $52.8K Y1)

**School Operations (V11 group):**
- Board Expenses
- Textbooks/Workbooks (separate from general supplies)
- Special Ed Supplies (separate from general supplies)
- Student Testing & Assessment
- Field Trips
- Staff Recruitment (separate from general PD)
- Stipends/Bonuses — Per-FTE driver
- Extra Curricular
- Office Expense

**Facility O&M (V11 group):**
- Janitorial Services (separate from general facilities)
- Repairs & Maintenance
- Security Services
- Utilities
- Equipment & Furniture
- Insurance (already first-class in SL)
- Building/Land Rent/Lease (already first-class in SL)

**Why this matters.** A Commission reviewer reading the SchoolLaunch Commission Excel export side-by-side with Cedar Grove's V11 will see a small number of high-level lines on the SL side and a granular itemization on the V11 side. The reviewer can't audit whether the SL school has budgeted for Nurse Services, SPED Services, Titlement Services, or Board Expenses specifically. This is a credibility issue, not a math issue.

**Proposed approach.**

1. Add a `custom_expense_lines` JSONB column to `school_profiles` (mirror of `custom_revenue_lines`).
2. Surface a "Custom Expense Lines" editor on the Operations tab letting users add lines with: name, category group (Contracted Services / School Operations / Facility O&M / Personnel-related), driver (Per Pupil / Per FTE / Flat / Inflation-escalator), Y1 amount.
3. Pipe through `computeMultiYearDetailed` and the Commission Excel export.
4. Pre-seed common WA Charter line names so applicants can pick from a list rather than free-text.

**Alternative.** Promote each frequently-used V11 line to a first-class field. More schema work but more guidance for applicants.

**Reference:** `tests/audit/v11-cedar-grove/session2/RECONCILIATION_REPORT.md` §2.2, V11 P&L Section 5 rows 230-270.

---

## Notes on disposition

Travis to review and decide whether to promote into `BACKLOG.md`. All three have a similar shape — they're real gaps documented with evidence, but none of them block Session 2 closure because the reconciliation report categorizes Cedar Grove's facility-debt expense and the line-type itemization as D2 + B "split" entries with explicit dollar magnitudes.

If promoting:
- P-FIN-01 and P-FIN-02 are paired; ship together.
- R-REV-07 is independent but synergizes with R-REV-03 (which adds revenue line types via the same `custom_*_lines` JSONB pattern).

End of candidate list.
