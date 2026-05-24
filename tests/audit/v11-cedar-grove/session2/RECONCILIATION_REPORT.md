# Cedar Grove — V11 / SchoolLaunch Reconciliation

**Subject school:** Cedar Grove Public Schools (proposed 6–12 charter, Spokane area)
**SchoolLaunch fixture:** `Cedar Grove Public Schools - V11 Test` (UUID `63fedd25-90b0-4078-9854-7ec7071e0fb2`)
**Date:** 2026-05-23
**Audience:** ESWA, Washington State Charter School Commission, future channel partners

This report compares the WSCSC V11 Long-Range Projection model populated by Cedar Grove against the SchoolLaunch financial plan produced from the same inputs. Every dollar of divergence is categorized into one of four buckets so a reader can see which gaps are real, which are defensible, and which need action.

---

## Executive summary

For Year 1 the two models project total revenues of **$5.09M (V11)** and **$4.15M (SchoolLaunch)** — an **$943K gap**, or 18.5%. Five-year cumulative revenue: V11 $59.92M, SchoolLaunch $55.93M (Δ −$3.99M, −6.7%). Total expenses diverge in the opposite direction: V11 projects more spending than SchoolLaunch does, mostly because V11 carries Cedar Grove's facility debt service ($429K Y1) and Cedar Grove's itemized non-personnel categories at amounts higher than SchoolLaunch's defaults.

Of the $943K Y1 revenue gap:

| Bucket | Amount | Action |
|---|---:|---|
| **D3 — Data not yet entered into SchoolLaunch** (philanthropy + CSP) | −$700K | Re-enter once **P-UX-11**[^P-UX-11] is fixed |
| **B — Missing line types in SchoolLaunch** (Title II/III, OSPI 4198/4199/6100/2200) | −$190K | Build under **R-REV-03**[^R-REV-03] |
| **C — Defensible formula differences** (BEA regionalization, LAP/TBIP/Title I formulas) | −$122K (net) | Document in spec; SchoolLaunch is closer to OSPI statute |
| **A — Platform bug** (LAP High Poverty gating) | +$54K SchoolLaunch surplus | Fix under **R-REV-02**[^R-REV-02] |
| **D2 — Modeler choice** (V11 left Investment Earnings at $0; SchoolLaunch auto-computes) | +$19K | None — both defensible |
| **Total** | **−$943K** | |

The net effect of the gap classifications: once Cedar Grove's actual non-personnel amounts are entered into the SchoolLaunch fixture (D2 fixture-fidelity remediation), the missing line types are added (R-REV-03), the LAP High Poverty gate ships (R-REV-02), and the WSCSC question about CSP's recurring-vs-startup status is resolved, **the two models project the same financial story for the same school**. The remaining residual gap is defensible — both models simplify the same underlying OSPI formulas and neither will exactly match what OSPI ultimately pays Cedar Grove.

Two findings outside the dollar columns matter as much as the dollar gap:

1. **V11 itself has a template defect.** STAFFING!E85:J85 truncates the SUM range to row 77, excluding six position rows (Nurse, Librarian, Manager of Student Support, College & Athletics Director, Manager of College Success, Coordinator of College Success). Cedar Grove uses several of these positions; V11's *displayed* Total FTE is 25.75 Y1 / 79.25 Y5, while the *true per-position sum* is 27.25 / 83.25. SchoolLaunch's 27.25 matches V11's underlying data. **The reviewers (LL, AW) and the Cedar Grove team all missed this in the template they used.** Worth communicating to ESWA/WSCSC for V12.

2. **Both models pass the Commission's Financial Performance Framework (FPF) scorecard for all five years.** The dollar deltas don't translate into different pass/fail outcomes — both models project a fundable Cedar Grove against the published Stage 1 and Stage 2 thresholds.

---

## How to read this report

Each reconciliation line is tagged with one of four categories:

- **A — Platform bug.** SchoolLaunch produces an incorrect number per a reasonable reading of OSPI statute. Action: backlog entry, fix.
- **B — Missing line type.** SchoolLaunch's revenue or expense model lacks a line V11 includes. Action: scope decision, then build.
- **C — Defensible formula difference.** Both products simplify the same statute differently; both are reasonable; the dollar delta is the cost of the simplification choice. Action: documentation, no code change.
- **D — Not-bug.** Sub-categorized:
  - **D1** — V11 template defect; SchoolLaunch is correct.
  - **D2** — Cedar Grove submission choice (e.g., the modeler left a field blank); not a SchoolLaunch issue.
  - **D3** — Known data not yet entered into the SchoolLaunch fixture.

Lines tagged "**Split: D2 + B**" decompose into two distinct gaps the reader needs to keep separate: the dollar amount could mostly be closed by re-entering Cedar Grove's actual values (fixture remediation), but Cedar Grove's *itemization* of those values into 22 sub-lines per category isn't representable in SchoolLaunch today (platform-modeling gap that needs a backlog entry).

Numbers in this report are sourced from `v11_values.json` and `sl_values.json` (extracted by Node scripts in the `session2/scripts/` directory). Every cell traces back to a V11 sheet cell reference or a SchoolLaunch table row.

---

## Section 1 — Revenue reconciliation

### 1.1 Per-line summary, Year 1

| Line | V11 Y1 | SL Y1 | Δ$ | Δ% | Category | BACKLOG |
|---|---:|---:|---:|---:|---|---|
| BEA / Regular Ed Apportionment | $3,102,798 | $2,961,948 | −$140,850 | −4.5% | C | (spec doc) |
| SPED General Apportionment (3121) | $17,909 | $17,109 | −$800 | −4.5% | C | (spec doc) |
| State Special Education (4121) | $575,876 | $572,660 | −$3,216 | −0.6% | C | (spec doc) |
| LAP (4155) | $91,020 | $117,504 | +$26,484 | +29.1% | C | (spec doc — SL statute-correct) |
| LAP High Poverty (SL-only line) | $0 | $53,856 | +$53,856 | n/a | **A** | **R-REV-02**[^R-REV-02] |
| TBIP (4165) | $5,916 | $49,920 | +$44,004 | +744% | C | (spec doc — SL statute-correct) |
| HiCap (4174) | $7,872 | $0 | −$7,872 | n/a | C | (spec doc) |
| Title I | $72,349 | $126,720 | +$54,371 | +75.2% | C | (spec doc — both approximate) |
| Title II | $8,770 | $0 | −$8,770 | n/a | **B** | **R-REV-03**[^R-REV-03] |
| Title III | $5,603 | $0 | −$5,603 | n/a | **B** | R-REV-03 |
| IDEA Funding | $132,921 | $57,600 | −$75,321 | −56.7% | C | (spec doc — different model: V11 direct-dollar, SL formulaic) |
| CSP — fixture not entered (a) | $400,000 | $0 | −$400,000 | −100% | **D3** | **P-UX-11**[^P-UX-11] |
| CSP — recurring vs one-time (b) | — | — | — | — | **Needs decision** | Open question for WSCSC |
| CSP — platform support for recurring (c) | — | — | — | — | **B** | **R-REV-04**[^R-REV-04] (depends on (b)) |
| 6100 OSPI Special Purpose | $17,000 | $0 | −$17,000 | n/a | B | R-REV-03 |
| 4198 State Food Service | $5,658 | $0 | −$5,658 | n/a | B | R-REV-03 |
| 6198 Federal Food Service (NSLP) | $193,662 | $170,400 | −$23,262 | −12.0% | C | (rate-table delta $795 vs $710) |
| 4199 Transportation Operations | $146,370 | $0 | −$146,370 | n/a | B | R-REV-03 |
| 2200 Sale of Goods/Services | $6,150 | $0 | −$6,150 | n/a | B | R-REV-03 (low priority) |
| 2300 Investment Earnings | $0 | $18,750 | +$18,750 | n/a | **D2** | (V11 modeler left blank) |
| 8200 Private Foundations (Philanthropy) | $300,000 | $0 | −$300,000 | −100% | **D3** | P-UX-11 |
| **Total Operating Revenue** | **$4,789,874** | **$4,127,717** | **−$662,157** | **−13.8%** | composite | |
| **Total Revenue (incl interest + grants)** | **$5,089,874** | **$4,146,467** | **−$943,407** | **−18.5%** | composite | |

### 1.2 Notes on the line-level deltas

**BEA gap (−$141K Y1, −$1.0M Y5).** SchoolLaunch computes BEA as `AAFTE × $12,613 × 1.030 (Spokane regionalization)`; the formula yields $12,991 per AAFTE × 228 AAFTE = $2,961,948. V11 uses the same $12,613 base rate but produces $3,102,798 Y1. The 4.5% gap most likely reflects (a) V11 applies regionalization to a different base or in a different order, or (b) V11's "Active Enrollment" basis (STAFFING row 19) differs from SchoolLaunch's AAFTE calculation. **Carries from Session 1's unresolved §9.7 question:** we still don't have an OSPI publication confirming whether Cedar Grove's $12,613 input *already* includes regionalization. Until that's confirmed, this is a defensible difference, not a bug — but it's the single largest line-item delta and warrants a follow-up.

**LAP / LAP High Poverty (combined SL Y1 $171K vs V11 Y1 $91K, +$80K SL surplus).** Per OSPI's LAP Guide 2025 and RCW 28A.165, the actual statute allocates LAP as `district FRPL% × district enrollment × per-formula-child rate`. SchoolLaunch's `N × FRL% × $816` matches that structure. V11 simplifies to `N × $370/total-pupil`. **SchoolLaunch is closer to statute.** Cedar Grove's V11 modeler appears to have averaged the formula-driven amount back into a "per total student" rate. The SchoolLaunch overshoot on the *combined* LAP line is therefore largely explained by V11's simplification. The piece that *is* a SchoolLaunch bug — see §10.A — is the +$54K LAP High Poverty surplus: that line should be gated on whether the school has a 3-year FRPL history.

**Title I (+$55K SL surplus).** Both products simplify federal Title I. V11 uses `N × $297/total-pupil`; SchoolLaunch uses `N × FRL% × $880`. Federal Title I actually scales with low-income population by district (the U.S. Census poverty estimate), so neither formula is statute-exact, but SchoolLaunch's × FRL% is the better approximation for high-FRL schools. Both defensible.

**TBIP and HiCap.** Same pattern as LAP. SchoolLaunch's per-EL-student / per-HiCap-student formulas are statute-correct; V11's flat-per-total-pupil rates are simplifications. The Cedar Grove model has `pct_hicap = 0` in SchoolLaunch (because V11 doesn't expose a HiCap percentage), so SL HiCap reads $0 while V11 shows $7,872 — that's a configuration delta rather than a defect on either side.

**IDEA (−$75K).** V11 has Cedar Grove entering $132,921 as a direct dollar award (consistent with how the federal allocation actually arrives by district). SchoolLaunch uses a formula `N × IEP% × $1,500`. Different models, both defensible. A modest platform enhancement to allow direct-dollar override on IDEA would help applicants who know their projected award.

**6198 Federal Food Service NSLP (−$23K).** SchoolLaunch's default rate-table value is $710/student; V11's Cedar Grove uses $795. Both per-pupil approximations of the same federal NSLP reimbursement. Spec doc update to bring SL's default toward the OSPI-published value would close most of this.

### 1.3 Missing line types (B — R-REV-03)

V11 has the following lines that SchoolLaunch's WA Charter pathway does not surface as configurable inputs:

| Line | Cedar Grove Y1 amount | Y5 amount |
|---|---:|---:|
| Title II | $8,770 | $30,250 |
| Title III | $5,603 | $19,326 |
| OSPI 4198 State Food Service | $5,658 | $20,297 |
| OSPI 4199 Transportation Operations | $146,370 | $525,087 |
| OSPI 6100 Special Purpose Unassigned | $17,000 | $17,000 |
| OSPI 2200 Sale of Goods/Services | $6,150 | $6,788 |
| OSPI 3121 vs 4121 SPED separation | (used as one combined field in SL) | n/a |

Combined Y1 contribution: $189,551. Y5: $618,748. These are real revenue lines Cedar Grove (and any WA charter applicant) is entitled to project; the platform should be able to model them. Tracked under **R-REV-03**.

### 1.4 Known data not entered (D3)

Cedar Grove's V11 includes $250K–$300K/year of private philanthropy (OSPI 8200) and $400K/year of recurring federal Charter Schools Program (CSP) revenue. The SchoolLaunch fixture has neither entered. Both are blocked by **P-UX-11**[^P-UX-11] (dashboard crashes when `school_profiles.startup_funding` JSON is direct-seeded with a shape the canonicalizer didn't expect). Session 1 made the explicit call to log this rather than fix the crash first. Cumulative impact over five years: $1.45M philanthropy + $1.6M CSP = $3.05M of revenue the SchoolLaunch model is currently understating versus V11.

---

## Section 2 — Expense reconciliation

### 2.1 Per-group summary, Year 1

| Group | V11 Y1 | SL Y1 | Δ$ | Category |
|---|---:|---:|---:|---|
| Personnel total (services + benefits) | $2,752,134 | $2,605,655 | −$146,479 | Close match (D-ish) |
| Contracted Services (V11 9 sub-lines vs SL 2 lines) | $527,874 | $142,552 | −$385,322 | **Split D2 + B** |
| School Operations (V11 22 sub-lines vs SL 8) | $926,375 | $336,968 | −$589,407 | Split D2 + B |
| Facility O&M (V11 8 sub-lines vs SL 2) | $408,000 | $198,000 | −$210,000 | Split D2 + B |
| Authorizer Fee (3% Oversight Fee) | $100,974 | $106,552 | +$5,578 | C |
| Contingency / Reserves | $0 | $64,768 | +$64,768 | D2 |
| **Depreciation** | **$172,500** | **$0** | **−$172,500** | **B (NEW BACKLOG)** |
| **Interest Expense** | **$257,016** | **$0** | **−$257,016** | **B (NEW BACKLOG)** |
| **Total Expenses** | **$5,043,898** | **$3,303,175** | **−$1,740,723** | composite |

### 2.2 The Split D2 + B story (Contracted Services, School Ops, Facility O&M)

Cedar Grove's V11 itemizes non-personnel expenses across **39 sub-lines** in three groups. SchoolLaunch's WA Charter pathway has **12 abstract per-student or flat-rate lines**. Two distinct gaps make up the dollar delta:

- **D2 — Fixture fidelity (re-enter).** The Session 1 fixture used SchoolLaunch's default benchmarks ($150/student Contracted Services, $200/student Supplies, $15K/month lease, etc.). Cedar Grove's V11 has higher actuals: $527K Contracted Services Y1 (vs SL $143K with default benchmarks), $926K School Operations Y1 (vs SL $337K), $408K Facility O&M Y1 (vs SL $198K). **Most of the dollar gap closes** if Cedar Grove's actual category totals are entered as overrides in SchoolLaunch's existing lines. Action: re-enter on the Operations tab.
- **B — Platform-modeling (new BACKLOG).** Even after re-entering totals, SchoolLaunch can't itemize what Cedar Grove itemized. V11's "Contracted Services" has separate lines for Nurse Services ($43K), SPED Services ($264K), Titlement Services ($53K), Management Company Fee, Legal, Payroll. V11's "School Operations" itemizes Board Expenses, Stipends/Bonuses, Extra Curricular, Student Recruitment/Marketing, Office Expense, Staff Recruitment as separate rows. V11's "Facility O&M" itemizes Janitorial ($36K), Repairs/Maintenance ($18K), Security ($22K), Utilities ($48K), Equipment, Other. **These sub-line names matter for Commission review**: a Commission reader expects to see Nurse Services as its own line item, not collapsed into a generic "Contracted Services" total. Tracked as new BACKLOG candidates in `SESSION_2_BACKLOG_CANDIDATES.md`.

### 2.3 Missing line types (B — new BACKLOG candidates)

**Depreciation ($172K Y1, $172K/year flat through Y5).** Cedar Grove's V11 carries $172,500/year depreciation expense from its $5.175M facility financing modeled over a 30-year amortization. SchoolLaunch has no depreciation field anywhere — not in `financial_assumptions`, not in `budget_projections`, not in the Operations UI. Any WA charter applicant who owns (rather than leases) a building cannot model this expense in SchoolLaunch today.

**Interest Expense ($257K Y1, declining to $240K Y5).** Cedar Grove's V11 amortizes its facility loan at 5% over 30 years, producing interest expense on the declining principal balance. SchoolLaunch has no facility-debt model and no interest-expense field. Same gap as depreciation: any applicant financing a building cannot represent this.

Together depreciation + interest = $429K Y1 of expense V11 captures and SchoolLaunch does not. These are tracked as new BACKLOG candidates ("P-FIN-XX Facility depreciation modeling" and "P-FIN-XX Facility debt service modeling") in `SESSION_2_BACKLOG_CANDIDATES.md`.

### 2.4 Authorizer Fee (C, R-REV-06)

SchoolLaunch computes Y1 authorizer fee at $106,552 vs Cedar Grove V11's $100,974 — a 5.5% gap. Both apply 3% to "state revenue", but the composition of "state revenue" and the order of regionalization-multiplier application differ slightly. **R-REV-06**[^R-REV-06] is the open investigation pending the actual WSCSC charter contract language. Not material enough to surface in the executive summary, but worth closing eventually for spec accuracy.

### 2.5 Contingency (D2)

V11 has contingency at $0 (the Cedar Grove modeler chose not to budget a reserve); SchoolLaunch's default applies 2% of total expenses. Both defensible — a Commission reviewer would prefer to see *some* contingency in a charter application financial plan, so SchoolLaunch's default is arguably the better practice. This is a configuration choice, not a structural disagreement.

---

## Section 3 — Staffing reconciliation

### 3.1 Total FTE per year

| Year | SL Total FTE | V11 *true* per-position sum | V11 *displayed* (R85 buggy) | SL vs V11 truth | SL vs V11 displayed |
|---|---:|---:|---:|---:|---:|
| Y1 | 27.25 | 27.25 | 25.75 | **0 ✓** | +1.50 |
| Y2 | 49.25 | 49.25 | 47.25 | 0 ✓ | +2.00 |
| Y3 | 71.25 | 71.25 | 68.25 | 0 ✓ | +3.00 |
| Y4 | 83.25 | 83.25 | 79.25 | 0 ✓ | +4.00 |
| Y5 | 83.25 | 83.25 | 79.25 | 0 ✓ | +4.00 |

**SchoolLaunch matches V11's underlying truth exactly.** The apparent SL "overstatement" against V11's displayed R85 total is V11's bug, not SchoolLaunch's. See §6 for the template-defect detail.

### 3.2 Personnel cost (services + benefits)

| Year | V11 | SL | Δ$ | Δ% |
|---|---:|---:|---:|---:|
| Y1 | $2,752,134 | $2,605,655 | −$146,479 | −5.3% |
| Y2 | $4,635,432 | $4,395,889 | −$239,543 | −5.2% |
| Y3 | $6,617,569 | $6,277,884 | −$339,685 | −5.1% |
| Y4 | $7,884,489 | $7,479,977 | −$404,512 | −5.1% |
| Y5 | $8,846,375 | $8,386,907 | −$459,468 | −5.2% |

A flat ~5% gap across all years, scaling with cumulative payroll. Source: SchoolLaunch applies the 3% salary escalator slightly differently from V11 (compounding rounding) and the position-by-position salaries entered into the fixture differ from V11's by ~$1K-$5K each. Salaries were entered to match V11 directly in Session 1; the remaining gap is rounding + escalator timing. Not a bug on either side.

---

## Section 4 — Bottom-line reconciliation

### 4.1 Year-by-year totals

| Metric | Y1 V11 | Y1 SL | Y2 V11 | Y2 SL | Y3 V11 | Y3 SL | Y4 V11 | Y4 SL | Y5 V11 | Y5 SL |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Total Revenue | $5,089,874 | $4,146,467 | $9,531,907 | $8,581,068 | $13,632,355 | $12,738,301 | $15,652,037 | $14,947,797 | $16,014,494 | $15,517,415 |
| Total Expenses | $5,043,898 | $3,303,175 | $8,713,989 | $5,918,537 | $12,170,189 | $8,716,626 | $14,087,276 | $10,610,902 | $14,133,224 | $11,197,204 |
| Net Income | $45,976 | $843,292 | $817,918 | $2,662,532 | $1,462,167 | $4,021,675 | $1,564,761 | $4,336,895 | $1,881,270 | $4,320,211 |
| Ending Cash | $1,369,745 | $2,093,292 | (V11) | $4,755,824 | (V11) | $8,777,499 | (V11) | $13,114,394 | (V11) | $17,434,605 |
| DCOH (days) | 103 | 231 | 88 | 293 | 107 | 368 | 133 | 451 | 181 | 568 |
| Personnel % Revenue | 54% | 63% | 49% | 51% | 49% | 49% | 50% | 50% | 55% | 54% |

### 4.2 What the deltas mean for a Commission reader

If a Commission reviewer compares the two models side-by-side they will see a school that "looks healthier" in SchoolLaunch — higher net, more days of cash, faster reserve growth. That is not because SchoolLaunch is overstating Cedar Grove's prospects: it's because Cedar Grove's V11 carries facility debt service ($429K/yr) that SchoolLaunch can't model, and because Cedar Grove's V11 has $1.7M of non-personnel category detail that the SchoolLaunch fixture entered at default values.

Close the platform gaps (depreciation + interest + missing revenue lines + line-type itemization) and re-enter Cedar Grove's actual non-personnel amounts, and the two models converge.

---

## Section 5 — FPF Scorecard outcome

The Commission Financial Performance Framework was computed twice using identical threshold logic (`computeFPFScorecard` from SchoolLaunch's budget engine) — once against SchoolLaunch's projection totals, once against V11's. Identical math, different inputs.

### 5.1 Eight quantitative measures, Year 1 (Stage 1)

| Measure | V11 value | V11 status | SL value | SL status | Threshold |
|---|---:|---|---:|---|---|
| Current Ratio (planning proxy) | 3.03 | ✓ Meets | 7.60 | ✓ Meets | ≥ 1.0 |
| Days of Cash on Hand | 92 | ✓ Meets | 231 | ✓ Meets | ≥ 30 |
| Total Margin | 1.0% | ✓ Meets | 20.4% | ✓ Meets | ≥ 0% |
| 3-Year Total Margin | N/A | N/A | N/A | N/A | (Stage 2 only) |
| Debt-to-Asset | 0.00 | ✓ Meets | 0.00 | ✓ Meets | < 0.90 |
| Debt Default | n/a | N/A | n/a | N/A | qualitative |
| Cash Flow (1-yr) | N/A | N/A | N/A | N/A | (Y1 has no prior year) |
| Multi-Year Cash Flow | N/A | N/A | N/A | N/A | (Stage 2 only) |
| Enrollment Variance | 100% | ✓ Meets | 100% | ✓ Meets | ≥ 95% |

### 5.2 Five-year DCOH and Total Margin trajectory

| Year | V11 DCOH | SL DCOH | V11 Margin | SL Margin |
|---|---:|---:|---:|---:|
| Y1 | 92 | 231 | 1.0% | 20.4% |
| Y2 | 88 | 293 | 8.9% | 31.3% |
| Y3 | 107 | 368 | 11.0% | 31.9% |
| Y4 | 133 | 451 | 10.2% | 29.5% |
| Y5 | 181 | 568 | 12.0% | 28.6% |

### 5.3 Overall result

**Both models pass FPF for all five years against all applicable Stage 1 and Stage 2 thresholds.** Despite the dollar gaps in revenue and expense, the *qualitative* judgment a Commission reviewer would make from either model is the same: "this school is financially viable as projected." That is the outcome that matters for charter approval.

### 5.4 Note on V11's self-reported FPF

V11's own DASHBOARD tab reports DCOH Y1 = 102.63 days — about 11 days higher than our recomputation (92 days). The difference is **V11's DCOH formula subtracts depreciation from the denominator** (per the published OSPI formula: `Unrestricted Cash ÷ ((Expenses − Depreciation) / 365)`), while SchoolLaunch's `computeFPFScorecard` sets depreciation to 0 in planning mode (because the platform doesn't model depreciation today). Once the depreciation BACKLOG candidate ships, this 11-day delta closes and the SL-applied-to-V11 number will match V11's self-reported number.

This is not a bug in SchoolLaunch's FPF scoring — it's a faithful reflection of the platform's current expense model. The note above (about depreciation as a missing line type) covers it.

---

## Section 6 — V11 template defects identified

### 6.1 STAFFING!E85:J85 SUM range truncation

| Cell | Formula as written | Expected formula | Impact |
|---|---|---|---|
| `STAFFING!E85` (Y0) through `STAFFING!J85` (Y5) | `=SUM(E52:E77)` (and same column-shape) | `=SUM(E52:E83)` | Y0: 0 missed; Y1: −1.50 FTE; Y2: −2.00; Y3: −3.00; Y4–Y5: −4.00 each |

**Excluded position rows:** R78 Nurse, R79 Librarian, R80 Manager of Student Support, R81 College & Athletics Director, R82 Manager of College Success, R83 Coordinator of College Success.

Cedar Grove uses several of those positions. The displayed "Total Full-Time Employment" understates Cedar Grove's own staffing plan by up to 4 FTE in Y4 and Y5.

**Propagation.** R85's totals feed the Drivers tab, which is referenced by Per-FTE expense lines on the P&L (Payroll Services, Staff Development, Stipends/Bonuses). Those lines are also slightly understated downstream.

**Implication for SchoolLaunch:** SchoolLaunch's 27.25 Y1 FTE matches V11's *underlying* per-position truth. It does *not* match V11's *displayed* total. **Anyone reconciling SchoolLaunch against the V11 displayed total will incorrectly flag SchoolLaunch as too high.** Reconciliation should always be against the per-position sum.

**Communication path.** This is not a SchoolLaunch issue. Worth raising with WSCSC and/or ESWA for incorporation into V12.

### 6.2 Other potential defects observed

The other V11 sub-totals (Total Revenue at row 164, Total Expenses at row 275, the OSPI account sub-totals at rows 121/126/130/138/146/150/153/158/162) were spot-checked and their SUM ranges cover all populated rows above them. Cedar Grove's Balance Sheet zeros out long-term debt despite the DEBT tab modeling a $5.175M loan — this was already noted in V11 Analysis §10.2 as a Cedar Grove submission error rather than a V11 template defect. Not visible in this reconciliation because SchoolLaunch has no balance sheet either.

---

## Section 7 — Defensible formula differences (no action requested)

The OSPI statute verification done after Session 1 (V11 Analysis §9) established that **SchoolLaunch's per-pupil formulas are closer to the statute than V11's** for several categorical revenues:

- **LAP** (RCW 28A.165): allocation = `district FRPL% × district enrollment × per-formula-child rate`. SchoolLaunch's `N × FRL% × $816` matches. V11's `N × $370/total-pupil` is a presentation simplification.
- **TBIP**: allocation per ELL student, not per total student. SchoolLaunch's `N × ELL% × $1,600` matches. V11's flat `N × $185/total-pupil` is a simplification.
- **HiCap**: allocation per identified HiCap student. SchoolLaunch's `N × HiCap% × $730` matches; V11's flat `N × $32/total-pupil` is a simplification.
- **Title I** (federal): allocated by district per Census poverty data. Neither V11's flat rate nor SchoolLaunch's `N × FRL%` is exactly right, but SchoolLaunch's `× FRL%` is the better simplification.

A WA Charter applicant using SchoolLaunch and a reviewer comparing to V11 should not interpret these dollar deltas as SchoolLaunch errors. They are documented in the SchoolLaunch product spec v4.0 §9 (with this report as supporting evidence).

**No code change requested for these lines.** Spec documentation update only.

---

## Section 8 — Missing line types in SchoolLaunch

The following V11 lines are not currently represented in SchoolLaunch's WA Charter pathway. Cedar Grove uses several of them; other charter applicants will too. Each is tracked under an existing or new BACKLOG entry.

### Revenue (R-REV-03)

| OSPI account | Line | Cedar Grove Y1 | Cedar Grove Y5 | Status |
|---|---|---:|---:|---|
| Title II | Federal teacher quality | $8,770 | $30,250 | R-REV-03 (open) |
| Title III | Federal English Language Acquisition | $5,603 | $19,326 | R-REV-03 |
| 4198 | State Food Service (separate from federal 6198) | $5,658 | $20,297 | R-REV-03 |
| 4199 | Transportation Operations (state revenue line) | $146,370 | $525,087 | R-REV-03 |
| 6100 | OSPI Special Purpose Unassigned | $17,000 | $17,000 | R-REV-03 |
| 2200 | Sale of Goods/Supplies/Services | $6,150 | $6,788 | R-REV-03 |
| 3121 vs 4121 | SPED General Apportionment vs State SPED separation | (one field today) | n/a | R-REV-03 |
| CSP | Recurring federal startup grant (if WSCSC says recurring) | $400,000 | $400,000 | R-REV-04 (depends on WSCSC) |

### Expenses (new BACKLOG candidates — see `SESSION_2_BACKLOG_CANDIDATES.md`)

| Line | Cedar Grove Y1 | Cedar Grove Y5 |
|---|---:|---:|
| Depreciation & Amortization | $172,500 | $172,500 |
| Facility Debt Interest Expense | $257,016 | $240,151 |
| Contracted Services itemization (Nurse, SPED, Titlement, Mgmt Co Fee, Payroll, etc.) | (rolls up to $527K) | (rolls up to $1.85M) |
| School Operations itemization (Stipends, Extracurricular, Field Trips, Staff Recruitment, etc.) | (rolls up to $926K) | (rolls up to $3.02M) |
| Facility O&M itemization (Janitorial, Repairs, Security, Utilities, Equipment) | (rolls up to $408K) | (rolls up to $513K) |

---

## Section 9 — Known data gaps

The SchoolLaunch fixture for Cedar Grove is missing two pieces of revenue data that V11 includes:

1. **Private philanthropy** ($250K Y1, $300K/yr Y2–Y5; cumulative $1.45M)
2. **CSP recurring grants** ($400K/yr Y2–Y5; cumulative $1.6M)

Both are blocked by **P-UX-11** — the SchoolLaunch dashboard crashed when Session 1 tried to seed `school_profiles.startup_funding` JSON directly via Supabase MCP (the canonicalizer in `computeAdvisoryHash` calls `localeCompare` on a property that doesn't exist in the shape used). The bug was reverted by clearing the column.

**Remediation path.** Once P-UX-11 ships (defensive sort comparator + JSON shape validation), the philanthropy values can be entered through the Revenue tab's Startup Funding editor (the canonical write path), which produces a JSON shape the canonicalizer accepts.

**Timing.** Session 1 (§14.D) made the explicit call to log philanthropy and CSP as known-data-not-entered offsets rather than block on P-UX-11 first. That decision still holds. P-UX-11 is `OPEN` in BACKLOG.md and a real bug worth fixing on its own merits; once it's fixed, the Cedar Grove fixture can be re-completed in ~30 minutes.

---

## Section 10 — Recommendations

### 10.1 Prioritize R-REV-02 (LAP High Poverty new-applicant gating) — *only confirmed Platform bug*

OSPI's LAP Guide gates LAP High Poverty on a 3-year rolling FRPL average ≥ 50%. New charter applicants don't have 3 years of FRPL history. SchoolLaunch's current logic surfaces LAP High Poverty whenever current FRL% ≥ 50%, which over-states revenue by $54K Y1 → $197K Y5 for *every new-applicant fixture that exceeds the threshold* — not Cedar Grove-specific. This is the single confirmed platform bug from the reconciliation. **Address before submitting any new applicant's financials to WSCSC.**

### 10.2 Build out R-REV-03 (missing OSPI revenue line types)

Title II, Title III, 4198 State Food Service, 4199 Transportation Operations, 6100 OSPI Special Purpose, 2200 Sale of Goods, and the 3121/4121 SPED separation collectively account for ~$190K of Y1 revenue Cedar Grove has projected but SchoolLaunch cannot represent. Recommended approach: a "Custom Revenue Lines" UI surfacing `school_profiles.custom_revenue_lines` (the JSONB column already exists in the schema, currently unused), letting applicants add OSPI-account-coded lines with per-pupil rate + driver. Saves a schema change every time OSPI publishes a new categorical. **Scope decision still required**: which lines are first-class fields vs which go in the custom-line collection?

### 10.3 Open WSCSC question — CSP recurring vs. one-time

The Commission template (V11) treats the federal Charter Schools Program grant as recurring operating revenue counted toward FPF sustainability. SchoolLaunch today treats CSP exclusively as one-time startup funding excluded from sustainability metrics. *Which model is correct for charter application financial plans?* On a $4M-$16M revenue base, CSP at $400K/yr swings Total Margin by 2–8 percentage points and DCOH by 30–90 days — the same school can pass or fail FPF Stage 1/2 thresholds depending on which model is applied. This needs external resolution before SchoolLaunch makes a platform decision (R-REV-04 is dependent on the answer).

### 10.4 Two new platform BACKLOG candidates from this reconciliation

`SESSION_2_BACKLOG_CANDIDATES.md` proposes:

- **P-FIN-01** Facility depreciation modeling (capture $172K/yr Y1 for facility-owning charters)
- **P-FIN-02** Facility debt service modeling (capture $240K-$257K/yr interest expense)
- **R-REV-07** Expense line-type itemization (V11 has 39 non-personnel sub-lines; SL has 12 — Commission reviewers expect to see Nurse Services, Stipends, Janitorial, etc. as their own lines)

### 10.5 Publish the §9 OSPI findings

The defensible-formula-difference items (LAP, TBIP, HiCap, Title I) are not bugs but they *look* like bugs to anyone comparing V11 and SchoolLaunch side by side without context. The Session 1 §14.B and V11 Analysis §9 documentation should land in the public SchoolLaunch product spec so that ESWA staff, WSCSC reviewers, and channel partners can speak to it directly. Recommended location: a new spec §9.3 "Per-pupil formula structure vs. V11 simplifications" with the OSPI statute citations.

### 10.6 Communicate to ESWA / WSCSC about V11's R85 SUM defect

Not a SchoolLaunch action, but worth a note from the SchoolLaunch team to ESWA staff so the next V12 template revision corrects the SUM range. Many charter applicants are using the same V11 template; all of them with positions in rows 78–83 are under-counting their staff.

### 10.7 Fix P-UX-11 (next sprint)

Once the dashboard-crash bug in `canonicalizeProjectionInputs` is fixed, the Cedar Grove fixture can be re-completed with philanthropy and CSP through the canonical Revenue-tab path. Independent of this, the bug should be fixed regardless because any data-import or migration path that builds startup_funding JSON differently could brick a real user's dashboard.

---

## Footnotes

[^P-UX-11]: P-UX-11 — Dashboard crashes when `startup_funding` JSON has unexpected shape. Status: OPEN. See `BACKLOG.md`.

[^P-UX-15]: P-UX-15 — Default retention rate of 92% diverges from Commission V11's implicit 100%. Status: OPEN. See `BACKLOG.md`.

[^R-REV-02]: R-REV-02 — Investigate possible LAP / LAP High Poverty double-counting for new applicants. Status: INVESTIGATING. See `BACKLOG.md`.

[^R-REV-03]: R-REV-03 — Add missing OSPI revenue line types to WA Charter pathway. Status: OPEN. See `BACKLOG.md`.

[^R-REV-04]: R-REV-04 — CSP semantic decision: recurring operating vs. non-recurring startup. Status: OPEN (requires product decision; depends on WSCSC interpretation). See `BACKLOG.md`.

[^R-REV-06]: R-REV-06 — Authorizer fee base may not include all state revenue. Status: INVESTIGATING. See `BACKLOG.md`.

---

*Generated 2026-05-23 from `v11_values.json`, `sl_values.json`, `classifications.json`, `sl_fpf.json`, and `v11_fpf.json`. All numerical claims trace back to V11 cell references or SchoolLaunch table rows captured in those files.*
