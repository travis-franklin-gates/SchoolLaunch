# V11 Commission Template — Deep Dive & SchoolLaunch Validation Plan

**Source file:** *V11 WA Charter Financial Projection — Cedar Grove — v3 LL edits / AW edits.xlsx*
**Subject school:** Cedar Grove Public Schools (6–12 charter, Spokane area)
**Analyst date:** May 22, 2026

---

## 1 · What this file actually is

This is the **Washington State Charter School Commission's V11 Long-Range Projection Model**, populated by Cedar Grove with two passes of edits (LL = first reviewer, AW = second reviewer). It's the official tool — not a school's custom spreadsheet — and the structure tells you exactly how the Commission expects financials to be presented.

Headline mismatch you should know about immediately: **SchoolLaunch's spec (v4.0) references "V8" throughout** ("Commission V8 template structure", "Commission V8 template format", "V8 template integration"). The Commission is on V11. Whether the underlying math has shifted or only the labels have, your Commission-format Excel export claims a version that's three releases stale. That alone warrants an audit pass.

## 2 · Cedar Grove at a glance

| Property | Value |
|---|---|
| Grade config | 6–12 (founding bands {6} and {9} — **non-contiguous**, the exact case your May 2026 expansion fix targeted) |
| FY27 (Year 0) | Pre-opening, $250K philanthropy in, $278K expenses out, ($22K) loss |
| FY28 (Year 1) | 240 students, K-1 founding bands at G6 and G9 |
| FY32 (Year 5) | 780 students at full buildout |
| Demographics | 16% SPED, 60% FRPL, 13% EL |
| Sensitivity scenario | 95% of planned (single lever, not your 3-scenario engine) |
| Y0 beginning cash | $1.25M |
| Facility | $5M building + $175K issuance, 30-yr amortization at 5% |
| Annual depreciation | $172.5K |
| Y1 surplus | $46K (thin) → Y5 surplus $1.88M |
| Y1 DCOH | 103 days → Y5 DCOH 195 days |

This is a reasonably-modeled school that passes Commission tests. It's a useful golden case.

## 3 · V11 architecture — how the Commission organizes the model

14 sheets, four conceptual layers:

**INPUT TABS (yellow):** INPUTS, ENROLLMENT, STAFFING, DEBT — every editable assumption lives here. The GUIDE sheet is explicit: cells in yellow are inputs, everything else is formula. Notably, **REVENUE is no longer its own tab in V11** — it has been pulled into INPUTS as Section 1. This is a structural change from earlier versions.

**P&L (blue):** the operating statement, multi-year. Includes a duplicate dashboard in rows 1–35 (sustainability ratios, per-pupil metrics) before the line-by-line P&L starts.

**CASH (purple):** monthly Year 1 only, with explicit timing taxonomy per revenue/expense line — every line is tagged with one of seven distribution patterns: *OSPI State Apportionment, Expense Reimbursement, 10-Month Academic Calendar, 12-Month Smoothing, Two-Installment (front-loaded), Two-Installment (back-loaded), or Direct Input*.

**OUTPUT TABS (green):** REPORTS, DASHBOARD — board-facing summaries.

**SUPPORTING:** Drivers (the FTE driver formulas), Roster, FY26 LAP Corrections, FY26 SpEd BEA Rates, Balance Sheet.

## 4 · Critical findings — where V11 doesn't match SchoolLaunch's assumptions

### 4.1 Fiscal year start — **MAJOR DISCREPANCY**

SchoolLaunch spec v4.0 §9.1 is explicit: *"WA charter schools operate on a September 1 – August 31 fiscal year (not July 1 – June 30)."*

The V11 Cash tab columns: **Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug.**

The order looks like Sep–Aug, which would match the spec. But the V11 GUIDE introduces this as "Year 1 Cash Flow Forecast" and the model's Year/FY columns use *calendar-year* labels (2027, 2028, etc.) — "Beginning Fiscal Year (Year 0): 2027" with Year 0 being pre-opening and Year 1 being 2028. The fiscal-year *boundary* in the V11 monthly schedule starts in September, consistent with your spec.

**But the September apportionment percentage in V11 is different from yours.** I extracted Cedar Grove's BEA monthly distribution and back-solved the percentages:

| Month | V11 (Cedar Grove BEA) | SchoolLaunch spec |
|---|---|---|
| Sep | 9.00% | 9% |
| Oct | 8.00% | 8% |
| Nov | 5.00% | 5% |
| Dec | 9.00% | 9% |
| Jan | 8.50% | 8.5% |
| Feb | 9.00% | 9% |
| Mar | 9.00% | 9% |
| Apr | 9.00% | 9% |
| May | 5.00% | 5% |
| Jun | 6.00% | 6% |
| Jul | 12.50% | 12.5% |
| Aug | 10.00% | 10% |

**That's an exact match.** Good news. *Your OSPI apportionment schedule is correct.* Test #1 in §6 confirms this against the raw Cedar Grove numbers.

### 4.2 Categorical revenue line set — **STRUCTURAL DIFFERENCE**

SchoolLaunch spec §6.2 lists Commission V8 revenue lines as: Regular Ed per-pupil, SPED per-pupil, **Small School Enhancement**, Facilities per-pupil, Levy Equity, Title I, IDEA, LAP, TBIP, HiCap, Food Service, Interest Income, Startup Grants (13 lines).

V11 INPUTS Section 1 uses **OSPI account codes** as line item names. Cedar Grove's actual populated lines:

| Account | V11 Line Name | Cedar Grove FY28 | In SchoolLaunch? |
|---|---|---|---|
| 1100 | Local Property Tax | $0 | No (correct — charters can't levy) |
| 2200 | Sale of Goods, Supplies, & Services | $6,000 | **Missing** |
| 2300 | Investment Earnings | $37,164 | Yes (Interest Income) |
| 2500 | Gifts, Grants, & Donations (Local) | $0 | Partially (Donations) |
| 3100 | Basic Education Apportionment (BEA) | $12,613/pupil | Yes (Regular Ed) |
| 3121 | Special Education — General Apportionment | $455/SPED pupil | **DIFFERENT from your model** |
| 4121 | Special Education — State | $14,631/SPED pupil | Yes (State SpEd) |
| 4155 | Learning Assistance Program (LAP) | $370/pupil | Yes (LAP) |
| 4165 | Transitional Bilingual (TBIP) | $185/EL pupil | Yes (TBIP) |
| 4174 | Highly Capable | $32/pupil | Yes (HiCap) |
| 4198 | School Food Service (State) | $23/pupil | **Missing — state portion** |
| 4199 | Transportation — Operations | $595/pupil | **Missing — separate line** |
| 5200 | General Purpose Federal Grants | $0 | N/A |
| Title I | Title I | $297/pupil | Yes |
| Title II | Title II | $36/pupil | **MISSING from SchoolLaunch** |
| Title III | Title III | $23/pupil | **MISSING from SchoolLaunch** |
| IDEA | IDEA | $132,921 direct (FY29+) | Yes (but Cedar Grove uses direct input, not per-pupil) |
| CSP | Charter Schools Program grant | $400K/yr Y2–Y5 | **MISSING from SchoolLaunch** |
| 6100 | Special Purpose — OSPI Unassigned | $17K/yr from Y2 | **Missing** |
| 6198 | School Food Services (Federal) | $795/pupil | Yes (Food Service — but combined) |
| 8200 | Private Foundations | $250–300K | Yes (Donations) |

**Notable gaps in SchoolLaunch's revenue model relative to V11:**

1. **Title II and Title III are not in your spec.** Cedar Grove projects $36 and $23 per pupil respectively. At 780 students that's ~$46K/yr combined. Small dollars but missing categoricals are noticeable to the Commission.

2. **CSP (Charter Schools Program federal startup grant)** is missing. Cedar Grove models $400K/year for years 2–5 = $1.6M cumulative. **This is the single largest revenue assumption in the Cedar Grove model after BEA.** Many WA charters apply for CSP. Its absence in SchoolLaunch will materially understate startup-period revenue for any school planning to apply.

3. **Transportation revenue (4199)** is its own line at $595/pupil in V11. SchoolLaunch treats transportation as an expense toggle but doesn't appear to model the matching revenue line.

4. **3121 Special Education — General Apportionment** is *separate from* 4121 Special Education — State in V11. They're $455 and $14,631 per SPED pupil respectively. SchoolLaunch may be conflating these or only modeling one.

5. **State School Food Service (4198) at $23/pupil** is separate from federal food service (6198 at $795/pupil). Combined treatment loses fidelity.

6. **6100 OSPI Special Purpose Unassigned** ($17K/year starting Y2 in Cedar Grove) — this is a catch-all for grant funding the Commission expects schools to model conservatively.

7. **Small School Enhancement is not visible as a line in Cedar Grove's V11.** This is significant: your spec treats SSE as a primary V8-template line item, but the Commission's V11 doesn't expose it as a dedicated row. Either (a) it's baked into BEA at $12,613/pupil already for Cedar Grove's size class, (b) it's calculated elsewhere and not surfaced in this view, or (c) Cedar Grove (240→780 students) isn't small enough to trigger it. Worth verifying — if (a), SchoolLaunch's separate SSE line may be double-counting against the V11 BEA rate. **This is the single most important question to resolve.**

### 4.3 Authorizer fee base — **WORKING ASSUMPTION VIOLATED**

Spec §9.7: *"The fee base includes SSE (working assumption pending charter contract verification)."*

V11 INPUTS R122 makes this explicit:
- **Oversight Fee: 3% of State Revenue**
- Cedar Grove FY28: $100,974 = 3% × ($12,613 BEA + state categoricals applied to 240 × headcount)

The base is "**state revenue**" — not just BEA. The Commission's calculation includes state categoricals (LAP, TBIP, HiCap, state SpEd, transportation, state food service) in the 3% base. If SchoolLaunch applies the 3% only to BEA or only to BEA+SSE, it understates the authorizer fee — a Commission-facing accuracy issue. Cedar Grove's $100,974 vs. (BEA alone × 3%) = $90,814 is a $10K/yr understatement at this size, $33K/yr at full buildout.

### 4.4 Personnel cost structure — **PARTIAL MATCH**

V11 INPUTS R82–R114 lists **30 position types** (you reference 27). The 3 extras Cedar Grove uses:
- Manager of Student Support
- College & Athletics Director
- Manager of College Success
- Coordinator of College Success

The benefits load: V11 has it as a per-position column (column J), uniformly **30% for every position** in Cedar Grove's model. That matches your spec's 30% SEBB+FICA assumption. **Confirmed match.**

The driver mechanism: V11 uses 7 driver types (`Fixed`, `Per Pupil`, `Per Pupil - Elem`, `Per Pupil - MS`, `Per Pupil - HS`, `Per Pupil - SPED`, `Per Pupil - EL`). Your spec mentions only "Fixed or Per Pupil" — P-UX-03 already notes the driver type isn't exposed in the UI. **V11's driver model is more granular by grade band, which directly affects how teacher FTE scales with enrollment.** This is worth verifying in your engine.

The COLA: V11 INPUTS R83–R114 column D shows a 3% annual salary growth — **your spec says 2.5%.** Cedar Grove's CEO salary goes from $206K → $238,810 over 5 years — that's 3.0% annually, not 2.5%. The Commission's template defaults to 3%. **Check whether your platform's hardcoded 2.5% should match the Commission's 3% default or remain configurable.**

### 4.5 Salary benchmarks — **YOUR DEFAULTS vs. V11 DEFAULTS**

V11 preloads OSPI/BLS WA salaries on the STAFFING tab (Section 2, rows 12–44). Cedar Grove uses these benchmarks. A spot-check:

| Position | V11 default | Cedar Grove uses | SchoolLaunch default (if you have one) |
|---|---|---|---|
| CEO/ED | $200,000 | $206,000 | ? |
| Principal/Head of School | $130,000 | $133,900 | ? |
| Assistant/VP | $95,000 | $97,850 | ? |
| Instructional Coach | $85,000 | — | ? |
| Teacher (Elementary) | *blank in V11* | not used | ? |
| Teacher (MS) | $70,000 | (used at $70K) | ? |
| Teacher (HS) | $70,000 | (used at $70K) | ? |
| SPED Teacher | $85,000 | (used at $85K) | ? |
| Paraeducator | $40,000 | (used at $40K) | ? |
| School Counselor | $75,000 | (used at $75K) | ? |
| CFO | $140,000 | (used at $140K) | ? |
| Custodian | $42,000 | (used at $42K) | ? |
| Substitute | $30,000 | (used at $30K) | ? |

**Action:** dump SchoolLaunch's default WA Charter salary table and diff against the above. Any salary that's >$5K off the V11 default will produce systematically different personnel costs vs. what Cedar Grove (and likely other Commission applicants) are submitting.

### 4.6 Non-personnel expense taxonomy — **DIFFERENT STRUCTURE**

V11 organizes non-personnel expenses by **category** (Contracted Services, School Operations, Facility Operations & Maintenance, Contingency) with **specific OSPI-aligned line items** within each (Accounting/Audit, Legal, Oversight Fee, Management Co. Fee, Payroll Services, Nurse Services, Special Ed Services, Titlement Services, etc.).

Your spec describes Operations as: Authorizer Fee, Facility Costs, Supplies/Tech/Contracted Services per-pupil benchmarks, Food Service toggle, Transportation toggle, Insurance, Startup Funding. **The categorization is more abstract than V11's OSPI-account-aligned line items.**

If schools or the Commission ever compare your Operations tab to a V11 export side by side, the line-item names won't match. For PDF/Excel exports this isn't fatal (you can map at export time), but for any future "import V11 → SchoolLaunch" or "export SchoolLaunch → V11" feature, **you'll need an OSPI account code mapping table.**

V11's drivers for non-personnel include `Inflation`, `Per Pupil`, `Per FTE`, `% of State Revenue`, `% of Recurring Revenue`, `Direct Input` — six driver types. Spot the difference: **V11 explicitly tags lines as `Per FTE`** (e.g., Payroll Services at $1,200/FTE, Staff Development at $800/FTE, Stipends at $400/FTE). This is a useful driver type your platform may not support; it auto-scales certain costs with staff size independent of enrollment.

### 4.7 Cash flow timing taxonomy — **YOU'RE MISSING IMPORTANT NUANCE**

V11's Cash tab tags every line with a distribution pattern. The seven patterns:

| Pattern | Used for | Example |
|---|---|---|
| `OSPI State Apportionment` | All state revenue lines | BEA: 9/8/5/9/8.5/9/9/9/5/6/12.5/10 |
| `Expense Reimbursement` | Federal categoricals | Title I, IDEA — small monthly + large catchup in Aug |
| `10-Month Academic Calendar` | Tuition-like, food service | Sep–Jun evenly, $0 Jul/Aug |
| `12-Month Smoothing` | Fixed monthly costs | Audit, Oversight Fee, Board Expenses |
| `Two-Installment (front-loaded)` | Philanthropy paid early | $150K Sep + $150K Feb (Cedar Grove) |
| `Two-Installment (back-loaded)` | Catch-all | Other Local |
| `Direct Input` | Manual override | Custom timing |

**Federal reimbursement timing is significantly different from what your spec describes.** Your spec §9.5 only covers the OSPI apportionment schedule and notes "federal grants are reimbursement-based" as a general principle. V11 actually models it: Title I = $0 Sep, $0 Oct, then ~$6K/month Nov–Jul, **$18K in Aug** (the catchup). The August spike is the *fiscal-year reimbursement catchup* — schools incur expenses, claim them, and get paid in arrears with the bulk reconciled at year-end.

**If your Cash tab uses a flat 1/12 distribution for federal revenue, you're materially overstating mid-year cash for any school with substantial federal funding.** Cedar Grove's IDEA alone is $133K/year by Y2 — at 1/12 that's $11K/month, but in V11's reimbursement model it's $0 in months 1–2 then catchup. The difference matters for DCOH calculations and any "will payroll clear" question.

### 4.8 Scenario engine — **YOU OVER-DELIVER**

V11 has **one sensitivity lever**: "Sensitivity Analysis % of Planned Enrollment" (Cedar Grove uses 95%). That's it. No Conservative/Optimistic comparison, no multi-lever model.

**Your 3-scenario engine with 5 levers is significantly more sophisticated than what the Commission template offers.** This is a competitive advantage. The risk: if your scenario *outputs* don't reconcile cleanly to a V11 sensitivity case for the same school, the Commission may not understand which scenario aligns with their framework. Consider labeling Conservative = "Commission-style 95% sensitivity" in the export.

### 4.9 FPF Scorecard — **CONFIRMED MATCH**

DASHBOARD Section 1 rows 10–22 of V11 list the exact 11-measure FPF. Your spec §9.6 captures the 4 quantitative measures correctly with matching Stage 1/Stage 2 thresholds:

| Measure | V11 Stage 1 | V11 Stage 2 | Your spec |
|---|---|---|---|
| Current Ratio | ≥1.0 | ≥1.1 | ≥1.0 / ≥1.1 ✓ |
| Unrestricted DCOH | ≥30 days | ≥60 days | ≥30 / ≥60 ✓ |
| Total Margin (Annual) | ≥0 | ≥0 | ≥0 / ≥0 ✓ |
| Enrollment Variance | ≥95% | ≥95% | ≥−5% (=95%) ✓ |

But V11 has **7 additional measures your spec doesn't list:**

- **Debt Default** — qualitative, manual eval
- **Aggregated 3-Year Total Margin (Rolling)** — Stage 2: >0 (N/A in Stage 1)
- **Debt-to-Asset Ratio** — Stage 1 & 2: <0.90
- **Cash Flow (Annual)** — Stage 1 & 2: >0
- **3-Year Cash Flow (Rolling)** — Stage 2: >0 (N/A in Stage 1)
- **Annual Financial Audit** — qualitative
- **Financial Reporting & Compliance** — qualitative
- **Financial Oversight** — qualitative

**Your Commission Scorecard tab probably needs to show all 7 of these, even if some are "Manual Evaluation - Dropdown" placeholders matching V11's approach.** Right now your spec only enumerates 4 quantitative measures plus 4 you've called "Stage 2" only. The full V11 has 4 always-evaluated quantitative measures + 4 quantitative measures with Stage 1 = N/A + 3 qualitative measures.

The **Debt-to-Asset Ratio at <0.90** is particularly important — Cedar Grove has $0 debt so it passes trivially, but any school with facility financing needs this measure modeled. Cedar Grove's DEBT tab models $5.175M financed at 5% × 30 years but the Balance Sheet shows $0 long-term debt — Cedar Grove's reviewers (LL & AW) appear to have stripped the debt out of the balance sheet but left it in the depreciation calc. **This is a bug in Cedar Grove's submission, not in V11.** Useful learning: even Commission-reviewed templates have plumbing errors.

### 4.10 Per-pupil bottom-line metrics — **YOU UNDER-DELIVER**

V11 P&L rows 19–35 surface a rich set of per-pupil and sustainability ratios:

- Surplus/Deficit per Pupil
- Total Revenue per Pupil / Recurring Revenue per Pupil / Non-Recurring Rev per Pupil
- Total Expense per Pupil
- Personnel Expense per Pupil (Total Comp.)
- Non-Personnel Expense per Pupil
- Recurring Revenue as % of Total Expenses (sustainability test)
- Total Compensation as % of Recurring Revenue (your 80% test)
- Facilities Expense as % of Recurring Revenue
- All Other Expenses as % of Recurring Revenue

**Your spec mentions Personnel %, Reserve Days, Total Margin, Break-Even Enrollment.** You may surface more in the actual UI, but these per-pupil metrics — especially **Recurring Revenue % of Total Expenses** and **Non-Recurring Revenue per Pupil** — are central to how the Commission evaluates sustainability. They flag schools whose budgets only balance because of one-time grants. Cedar Grove sits at 95%→111% on this measure across Y1–Y5.

### 4.11 What V11 has that you have AND that's working well

- **Year 0 (pre-opening) treatment.** V11 explicitly has a Year 0 column ($278K of pre-opening expenses, $250K philanthropy, $0 ongoing operations). Your spec §6.6 also covers this. Match.
- **Sensitivity at 95% of planned.** Your Conservative scenario at standard 90% fill maps reasonably here.
- **Iterative calculations required.** V11 GUIDE row 1 column M: *"REQUIRES 'ITERATIVE CALCULATIONS' TO BE ENABLED"* — this is because the model has a circular reference (interest earnings depend on average cash, average cash depends on interest). Your platform doesn't have this constraint, but be aware that schools comparing the two may see small discrepancies due to circular resolution.

## 5 · Summary of validation priorities

Ranked by potential impact on Commission alignment:

| # | Issue | Severity | Effort to validate |
|---|---|---|---|
| 1 | **Small School Enhancement — is it double-counted or missing?** Does V11 bake SSE into BEA at $12,613, or is Cedar Grove just too large to trigger it? | **HIGH** | Medium |
| 2 | CSP startup grant missing from SchoolLaunch revenue model | **HIGH** | Low — add a line |
| 3 | Title II and Title III missing | MEDIUM | Low — add two lines |
| 4 | Federal cash flow timing — reimbursement, not 1/12 | **HIGH** | Medium — refactor timing logic |
| 5 | Authorizer fee base = total state revenue, not BEA+SSE | **HIGH** | Low — change formula |
| 6 | Salary COLA: V11 default 3% vs SchoolLaunch 2.5% | MEDIUM | Low — config change |
| 7 | FPF Scorecard: 11 measures in V11, 4 in spec | MEDIUM | Medium — extend scorecard |
| 8 | Driver type granularity: V11 uses 7 (incl. Per FTE for non-personnel) vs. your "Fixed/Per Pupil" | MEDIUM | Medium — schema work |
| 9 | Salary benchmark defaults — diff your defaults against V11 | MEDIUM | Low — diff exercise |
| 10 | Per-pupil sustainability ratios on dashboard (esp. Recurring Rev % of Total Expenses) | LOW–MED | Low — add metrics |
| 11 | Account code mapping (V11 uses OSPI codes throughout) | LOW | Medium — only matters for import/export |
| 12 | V8 vs. V11 labeling throughout SchoolLaunch spec and exports | LOW | Low — rename |
| 13 | 3121 SPED General Apportionment vs. 4121 SPED State as separate lines | LOW | Low — add line |

## 6 · The testing process — concrete plan

The goal is to run Cedar Grove through SchoolLaunch and produce a **side-by-side reconciliation report** between SchoolLaunch outputs and V11 outputs for the same inputs. Discrepancies > $500/year per line item warrant investigation.

### Phase 1 — Set up the test case (one session, 2–3 hours)

1. **Create a new test school in SchoolLaunch** matching Cedar Grove exactly:
   - State: Washington, School Type: Charter (routes to WA Charter pathway)
   - Opening year: 2027 (Year 0 = pre-opening, Year 1 = 2028)
   - Founding grades: {6, 9} — this exercises the May 2026 non-contiguous-band fix
   - Full buildout: 6–12
   - Y0 starting cash: $1,250,000
   - Sections × students/section as needed to hit 240 / 480 / 690 / 780 / 780
   - Demographics: SPED 16%, FRPL 60%, EL 13%, HiCap (set whatever Cedar Grove uses or 5% default)

2. **Match the per-pupil rates** to Cedar Grove's Year 1 inputs from V11 INPUTS R41–R62:
   - BEA: $12,613
   - SPED General: $455 / SPED student
   - SPED State (4121): $14,631 / SPED student
   - LAP: $370
   - TBIP: $185 / EL student
   - HiCap: $32
   - Title I: $297
   - Food Service (federal 6198): $795
   - Transportation: $595
   - State Food Service (4198): $23 — **may need to be added as custom line**

3. **Build the staffing plan** to match Cedar Grove's V11 STAFFING R52–R83 (the FTE allocation table I extracted). 25.75 FTE Y1 → 79.25 FTE Y5. This will be tedious but it's the only way to isolate revenue-vs-expense discrepancies.

4. **Operations** — match the non-personnel inputs as closely as possible. Some line names will differ; map by category.

5. **Note all gaps** as you go — line items you can't enter, drivers that don't match, rates that aren't configurable.

### Phase 2 — Generate the reconciliation (one session, 2 hours)

Run SchoolLaunch's exports (Commission V8 Excel + Budget Narrative PDF) on the test school. For each of Y1–Y5 capture:

**Revenue (line by line):**
- BEA, SPED General Apportionment, State SPED, LAP, TBIP, HiCap, Food Service (federal), Transportation, State Food Service, Title I, Title II, Title III, IDEA, CSP, Other Federal Special Purpose, Investment Earnings, Philanthropy, Charter School Program startup, **Small School Enhancement**

**Expenses (totals + per-pupil):**
- Personnel total, Benefits total, all Contracted Services subtotal, all School Ops subtotal, all Facilities subtotal, Authorizer Fee, Depreciation, Interest

**Bottom line:**
- Total Revenue, Total Expenses, Net Income, Beginning Cash, Ending Cash, DCOH, Personnel % of Revenue

**Build a spreadsheet** (literal Excel file) with three columns per metric: V11 / SchoolLaunch / Diff ($) / Diff (%). Sort by absolute diff descending. Anything > $500/year flags.

### Phase 3 — Diagnose each material discrepancy (variable, 4–10 hours total)

For each flagged line, the diagnostic order:

1. **Is the input rate the same?** If not, that's the cause — log it and move on.
2. **Is the line item the same?** If V11 has CSP and SchoolLaunch doesn't, that's the cause.
3. **Is the formula the same?** Check by recreating the calc by hand:
   - For per-pupil revenue: AAFTE × rate × COLA^(year-1)
   - For SPED: SPED count × rate
   - For categoricals with thresholds (LAP High Poverty): verify threshold logic
   - For the authorizer fee: confirm the base
4. **Is the timing the same?** (Only relevant for cash flow and DCOH.) Check the monthly distribution per line.
5. **Is there a regionalization multiplier issue?** Cedar Grove is in Spokane area — your spec says regionalization applies to Regular Ed, SPED Apportionment, and State Special Education. Verify Cedar Grove's V11 rates are the regionalized or de-regionalized versions.

### Phase 4 — Write the findings into the codebase (variable)

Each diagnosed discrepancy becomes one of:

- **Backlog entry** (P-XX-## or R-REV-##) if the platform produces incorrect output
- **Spec update** (revise v4.0 → v4.1) if the platform is right but the spec is mislabeled (e.g., "V8" → "V11")
- **No-action** if the difference is a Commission template artifact (e.g., Cedar Grove's balance sheet bug)

### Phase 5 — Build the test into the regression suite

Cedar Grove becomes a **second golden test alongside Spokane Arts Academy**. The Playwright smoke test currently runs Cedar Ridge Academy through Phases 1–7; extend with a Cedar Grove fixture that:

- Sets up the school via API (skip onboarding UI tedium)
- Calls the V11 export
- Compares specific cell values against a stored Cedar Grove V11 baseline
- Fails the build if any tracked line drifts > $100/year

This converts "we audited V11 once in May 2026" into "every commit gets checked against V11 expectations."

## 7 · The single most important thing to check first

**Whether Cedar Grove's $12,613 BEA rate already includes Small School Enhancement.**

If yes → SchoolLaunch's separate SSE line is double-counting and any WA charter applicant under SchoolLaunch will have inflated state revenue projections vs. what the Commission expects.

If no → SSE is calculated outside the BEA line in V11 and Cedar Grove either doesn't trigger it (240 students at 6–7 grades is at the threshold) or it's hidden in a different tab I haven't traced.

To resolve: find an OSPI BEA rate publication for FY28 and compare it to $12,613. If the published rate matches, SSE is not in BEA. If the published rate is lower, SSE is baked in. The FY26 SpEd BEA Rates sheet in this same workbook (382 rows, sheet 14) may have the answer — that's the next thing to read if you want me to chase this down.

## 8 · One-line bottom line

V11 mostly aligns with your spec on the big mechanics (OSPI apportionment schedule, 30% benefits load, FPF Stage 1/2 thresholds), but **diverges materially on revenue line completeness (CSP, Title II/III, transportation, state food service), authorizer fee base, federal cash timing, scorecard breadth, and the SSE question that needs immediate resolution.** The fact that your spec still calls this template "V8" suggests the gap has been growing for some time without a structured re-baseline against the Commission's working document.
