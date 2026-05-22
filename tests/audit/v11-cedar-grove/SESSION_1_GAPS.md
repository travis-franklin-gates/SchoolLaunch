# Session 1 — Cedar Grove V11 Test Fixture Gaps Log

**Date:** 2026-05-22
**School UUID:** `63fedd25-90b0-4078-9854-7ec7071e0fb2`
**School name in SchoolLaunch:** `Cedar Grove Public Schools - V11 Test`
**Test account:** `cedar-grove-v11@schoollaunch.test` / password `excellent!` (the `!` added because the signup form rejected the plain-text "excellent" — requires at least one number or symbol)

This is the data‑entry session report. It captures every V11 input that did not enter the platform cleanly, every place SchoolLaunch's defaults diverged from V11, and every UI surprise encountered along the way. No diagnosis is performed here — only logging. Session 2 will run the reconciliation.

---

## 1 · Y1 totals at end of session: SchoolLaunch vs V11

| Metric | SchoolLaunch (Y1) | V11 (Y1 expected) | Δ |
|---|---:|---:|---:|
| Enrollment (headcount) | 240 | 240 | **match** |
| AAFTE @ 95% | 228 | 228 | match (derived) |
| Total Operating Revenue | $4,127,717 | $5,089,874 | **−$962,157** |
| Total Personnel (incl 30% benefits) | $2,605,655 | (not extracted) | n/a |
| Total Operations | $697,520 | (not extracted) | n/a |
| Total Expenses | $3,303,175 | (not extracted) | n/a |
| Net Position Y1 | $824,542 | $46K | **+$778K** |
| Days of Cash Y1 | 91 | 103 | −12 days |
| Y1 FTE | 27.25 | 25.75 | **+1.50** (see §6) |
| Personnel % Revenue | 63.1% | (not extracted) | n/a |

**Y2–Y5 enrollment totals match V11 exactly** (480 / 690 / 780 / 780) — only because retention was forced to 100 % (see §3).

The +$962K revenue gap is **expected at this stage** because the platform is missing several V11 revenue lines (§4) and uses different per-pupil formulas for the lines it does have (§5). Session 2 will diagnose.

---

## 2 · Schema observations (Phase −1 verification)

All five tables present with the expected columns. Two minor discrepancies vs the session brief's wording:

| Brief said | Actual |
|---|---|
| `school_profiles.onboarding_completed_at` (implied timestamp) | `school_profiles.onboarding_complete` (boolean). No timestamp column exists. |
| `schools.pathway`, `state`, `school_type` | All present and nullable — Cedar Grove row populated as `wa_charter` / `WA` / `charter`. ✓ |

Schema highlights that informed this session:
- `school_profiles.financial_assumptions` JSONB default already has `revenue_cola_pct: 3` (matches V11). Default `salary_escalator_pct` is 2.5 — was changed to 3 (see §3).
- `school_profiles.fiscal_year_start_month` defaults to `9` (September). ✓
- `school_profiles.custom_revenue_lines` (jsonb default `[]`) — the schema *does* have a custom-line slot, but the Revenue page UI surfaced no editor for it within this session's scope. Worth checking in Session 2.
- `school_profiles.startup_funding` (jsonb default `[]`) is where Year-by-year grant/donation rows live. Format mismatch caused a dashboard crash — see §10.
- `staffing_positions` includes the May 2026 `manual_override` column. ✓

---

## 3 · Platform defaults vs V11 — what was changed and what was left

| Field | SchoolLaunch default | V11 value | Action |
|---|---|---|---|
| `financial_assumptions.revenue_cola_pct` | 3 % | 3 % | **already matches** ✓ |
| `financial_assumptions.salary_escalator_pct` | 2.5 % | 3.0 % | **changed → 3.0** (Settings → Expense Assumptions → Save) |
| `financial_assumptions.benefits_load_pct` | 30 % | 30 % | already matches ✓ |
| `financial_assumptions.authorizer_fee_pct` | 3 % (locked, disabled input) | 3 % | already matches; **but base may differ** — see §5.B |
| `financial_assumptions.ops_escalator_pct` | 2 % | (not explicitly in V11; V11 doesn't expose a unified ops escalator) | left at 2 % |
| `financial_assumptions.aafte_pct` (% of headcount) | 95 % | 95 % | already matches ✓ |
| `regional_factor` (Spokane County) | 1.030× | (V11 uses already-regionalized rates or applies its own; not directly comparable) | left at 1.030 |
| `retention_rate` | 90 % | (V11 has no retention; implicit 100 %) | **changed → 100** (Settings → Grade Expansion Plan → Save) |
| `pct_iep` / `pct_frl` / `pct_ell` / `pct_hicap` | 0/0/0/0 | 16/60/13/(unspecified) | **set to 16 / 60 / 13 / 0** (HiCap left at 0 since V11 doesn't expose a HiCap percentage; V11 just applies $32/pupil flat to all enrollment — see §5.A) |
| `school_profiles.regular_ed_per_pupil` | $12,000 | $12,613 | **changed → 12613** |
| `financial_assumptions.sped_per_pupil` (SPED Apportionment) | $4,500 | $455 | **changed → 455** (Note: a 10× difference — SchoolLaunch's default appears to conflate the 3121 General Apportionment with something else; check whether the field's *meaning* is the same in Session 2) |
| `financial_assumptions.state_sped_per_pupil` | $13,556 | $14,631 | **changed → 14631** |
| LAP High Poverty | $374/pupil | $370/pupil (V11 has just "LAP" $370/pupil, not a separate "LAP High Poverty" line) | left at $374 — see §5.C |
| Levy Equity | $0 | $0 | already matches ✓ |
| Facilities per pupil | $0 | $0 | already matches ✓ |
| Operations: Supplies per Student | $200 | (V11 not extracted at this granularity) | left at default |
| Operations: Contracted Services per Student | $150 | (V11 has category total ~$830K Y2) | left at default — see §7 |
| Operations: Technology per Student | $180 | n/a | left at default |
| Operations: Insurance Annual | $18,000 | n/a | left at default |
| Operations: Curriculum per Student | $500 | n/a | left at default |
| Operations: Professional Dev per FTE | $1,000 | n/a | left at default |
| Operations: Food Service per Student | $1,200 | n/a | left at default |
| Operations: Transportation per Student | $800 | n/a | left at default |
| Operations: Food Service Revenue per Student | $710 | $795 (federal) + $23 (state) = $818 | left at default — see §4 |
| Operations: Marketing per Student | $200 | n/a | left at default |
| Operations: Fundraising Annual | $15,000 | n/a | left at default |
| Facility lease monthly | $15,000 ($180K/yr) | V11 has $0 Y1 rent (Cedar Grove owns; depreciation+interest start Y1) and $240K Y2 / $300K Y3-5 lease lines | **left at default** — Session 2 should refine on Operations tab |

---

## 4 · V11 revenue lines that don't exist as configurable inputs in SchoolLaunch

These are *missing line items*. Even with overrides on the Revenue page (which exists per-line), they cannot be entered without a code-level addition.

| OSPI account | V11 line | Cedar Grove Y1 amount | SchoolLaunch status |
|---|---|---:|---|
| Title II | Federal Title II | $36/pupil ($8,640 Y1) | **MISSING** — no input or override path on Revenue page |
| Title III | Federal Title III | $23/pupil ($5,520 Y1) | **MISSING** — no input or override path |
| CSP | Charter Schools Program startup grant | $0 Y1, $400K Y2-Y5 | **MISSING as a revenue line.** The Revenue page has a "Startup & Other Grants — Funding Sources" section with default rows for "Federal CSP Grant" but it's modeled as one-time startup funding *not included in sustainability metrics* — semantically different from V11's recurring categorical |
| 4198 | State Food Service | $23/pupil ($5,520 Y1) | **MISSING** — Revenue page has only "Food Service (NSLP)" using a $710/student federal estimate, no separate state line |
| 4199 | Transportation Operations | $595/pupil ($142,800 Y1) | **MISSING as a revenue line.** Transportation is modeled as an *expense* benchmark ($800/student) with a "Transportation" Program toggle but the matching state revenue line is not surfaced |
| 6100 | OSPI Special Purpose Unassigned | $0 Y1, $17K Y2-Y5 | **MISSING** — no input |
| 3121 | SPED General Apportionment | $455/SPED student | Possibly conflated with the $4,500/SPED-student default "SPED Apportionment" field — see §3. The session *did* override the value to $455, but it's unclear if SchoolLaunch's formula treats it as 3121-equivalent or something else. **Verify in Session 2.** |
| 8200 | Private Foundations (philanthropy) | $250K Y1, $300K Y2-Y5 | Partially supported via Startup Funding JSON, but **see §10** — direct JSON edit triggered a dashboard crash; the data was reverted to `[]`. Philanthropy is not currently configured in this fixture |
| 2200 | Sale of Goods/Supplies/Services | $6,000 Y1 | **MISSING** — minor amount |
| 8200 | Donations (Local) | $0 Y1 (Cedar Grove) | n/a |
| 2300 | Investment Earnings | $37,164 Y1 | Possibly modeled — Settings has "Interest Rate on Cash" 3 % default. Not verified in this session. |
| IDEA | IDEA federal SPED | $0 Y1, $132,921 Y2 (Cedar Grove enters as direct dollar, not per-pupil) | SchoolLaunch's "IDEA (Federal Special Ed)" line uses `students × IEP% × $1,500` = $57,600 — non-zero in Y1. **Different model.** |

---

## 5 · V11 revenue lines that DO exist in SchoolLaunch but with different formulas

These are model‑structure differences. They will produce different Y1 values regardless of what rate you enter.

### 5.A — Per-pupil flat vs. per-(qualifying-group) calc

| Line | V11 formula | SchoolLaunch formula | Cedar Grove Y1 effect |
|---|---|---|---|
| Title I | `students × $297` | `students × FRL% × $880` | V11: $71,280 / SchoolLaunch: $126,720 (+$55K) |
| LAP (general) | `students × $370` | `students × FRL% × $816` | V11: $88,800 / SchoolLaunch: $117,504 (+$29K) |
| TBIP | `EL students × $185` | `students × ELL% × $1,600` | V11: $5,772 (31 EL × $185) / SchoolLaunch: $49,920 (+$44K) |
| Highly Capable | `students × $32` (all students, flat) | `students × HiCap% × $730` | V11: $7,680 / SchoolLaunch: $0 (HiCap% = 0 in this fixture) |
| LAP High Poverty | (not in V11 as a separate line) | `students × FRL% × $374` | V11: $0 / SchoolLaunch: $53,856 (+$54K — **possibly double-counting LAP**) |

The pattern: SchoolLaunch tries to be more sophisticated by multiplying by the qualifying-percentage. V11 just uses a flat per-pupil rate for several lines. This makes side-by-side reconciliation non-trivial.

### 5.B — Authorizer fee base

SchoolLaunch shows Y1 authorizer fee as a stored Operations line of $102,005. V11 INPUTS R122 documents the fee base as "3% of State Revenue" with Cedar Grove Y1 = $100,974. Close but not identical — Session 2 should verify whether SchoolLaunch's $102,005 is 3% of just BEA, BEA+state-categoricals, or BEA + state-categoricals + the regionalization multiplier.

### 5.C — LAP vs LAP High Poverty

V11 has one "LAP" line at $370/pupil. SchoolLaunch has two: "LAP" (FRL-conditioned at $816/FRL student) AND "LAP High Poverty" ($374/FRL student). Either Cedar Grove's V11 model is omitting the High Poverty add-on (because OSPI lumps them) or SchoolLaunch is splitting LAP in a way V11 doesn't.

### 5.D — Food Service revenue

V11: federal 6198 at $795/pupil + state 4198 at $23/pupil = $818/pupil = $196,320 Y1.
SchoolLaunch: combined "Food Service (NSLP)" at $710/student = $170,400 Y1.
Gap: −$25,920 in Y1.

---

## 6 · Staffing observations

Process: the session brief gave 23 V11 positions with FTE-by-year and salaries. **My per-position FTE inserts match the brief exactly**, but the summed totals do not match the brief's stated totals:

| Year | My input (per-position sum) | Brief stated total | Diff |
|---|---:|---:|---:|
| Y1 | 27.25 | 25.75 | +1.50 |
| Y2 | 49.25 | 47.25 | +2.00 |
| Y3 | 71.25 | 68.25 | +3.00 |
| Y4 | 83.25 | 79.25 | +4.00 |
| Y5 | 83.25 | 79.25 | +4.00 |

**The brief contains an internal inconsistency.** Either some per-position FTE values in the brief are wrong, or the stated totals are wrong, but they don't reconcile. I went with the per-position values as authoritative because that's what's actually entered position-by-position. **Recommend reconciling against the V11 STAFFING tab in Session 2 to determine which is the V11 truth.**

Staffing entry method: hybrid as approved. 3 positions (CEO, Teacher MS, Paraeducator) were edited via the dashboard UI to verify the write path; the remaining 20 positions × 5 years were bulk-inserted via Supabase MCP into the same `staffing_positions` table the UI reads from. All 115 rows present (23 positions × 5 years; positions with FTE = 0 are inserted as rows so the Staffing tab displays them).

Salaries are auto-escalated 3 % per year by the dashboard's `Save Changes` handler. For the bulk SQL inserts I applied the same `salary × 1.03^(year-1)` formula in the INSERT, rounding to integers. This matches V11's COLA assumption.

**One UI bug observed:** editing a position's title via the inline text input on the Staffing tab did NOT persist to the database — only the salary and FTE numeric edits stuck. The default "Classroom Teacher - Elementary" position retains that title even after I typed "Teacher MS" into the input and clicked Save Changes. This was worked around by deleting all default rows and re-inserting with the correct titles via SQL.

Salary defaults vs V11 (where the field exists in SchoolLaunch's default catalog):

| Position | SchoolLaunch default | V11 default | Cedar Grove | Notes |
|---|---:|---:|---:|---|
| CEO / Executive Director | $120,000 | $200,000 | $206,000 | SchoolLaunch default is ~40 % below V11 |
| Principal / Head of School | $95,000 | $130,000 | $133,900 | SchoolLaunch ~27 % below |
| Classroom Teacher Elementary | $58,000 | (blank in V11) | n/a | n/a |
| SPED Teacher | $62,000 | $85,000 | $85,000 | SchoolLaunch 27 % below |
| Administrative Asst | $52,000 | n/a | $68,000 | SchoolLaunch 24 % below |
| Paraeducator | $38,000 | $40,000 | $40,000 | SchoolLaunch 5 % below |

If a school onboards using SchoolLaunch's default salaries with WA Charter pathway, **personnel costs will be systematically lower than the Commission's V11 benchmark.** Session 2 may want to surface this in the spec.

---

## 7 · Operations entry — deferred

Operations was completed with onboarding defaults plus the per-student benchmarks listed in §3. V11 category totals (Contracted Services ~$830K Y2, School Ops ~$880K Y2, Facilities ~$408K Y2 incl. rent) were NOT matched line-by-line. SchoolLaunch's per-student-driver structure does not map cleanly to V11's OSPI account-aligned line items (§4.6 of the V11 analysis already documented this).

The dashboard Operations tab was not exercised in this session. Session 2 will need a separate pass to:
- Set facility lease to V11 values per year ($0 Y1 / $240K Y2 / $300K Y3-Y5) — note V11 also models depreciation & interest separately, which may not be configurable here
- Refine per-student benchmarks to align with V11 category totals (or accept the structural gap and document it)
- Add the $5.175M facility debt at 5 % × 30 yr, if the platform supports it

---

## 8 · Enrollment / class size constraints

V11's Cedar Grove uses 1 section × 120 students/section for middle grades and 1 section × 90 for high school. SchoolLaunch's onboarding UI does NOT cleanly represent this — its sections combobox is capped at 10 and the students/section spinbutton defaults to 24 with no obvious cap shown. I matched the V11 enrollment totals (240/480/690/780/780) using:
- Grades 6–10: **5 sections × 24 students = 120 students** per grade
- Grades 11–12: **3 sections × 30 students = 90 students** per grade

This produces the correct AAFTE per grade per year, but anyone reading the model in SchoolLaunch would see a "5 sections" structure rather than the actual planned "1 section of 120". Cosmetic but worth knowing if/when this fixture is shown to anyone modeling Cedar Grove.

The `school_profiles.max_class_size` default is 24 in the schema — the platform appears to assume conventional class sizes by default.

**The retention rate default of 90 % is significant.** With 90 %, the stored `target_enrollment_y2..y5` were 456 / 620 / 648 / 583 — well below V11. Setting retention to 100 % produced the V11-matching 240 / 480 / 690 / 780 / 780. V11's Cedar Grove model implicitly assumes 100 % retention; this should be documented as a default that needs adjustment for V11 alignment.

---

## 9 · Regionalization

Spokane County's regionalization factor in SchoolLaunch is **1.030×**, applied automatically based on county selection. The Revenue page surfaces this as a multiplier on Regular Ed, SPED, LAP, TBIP, HiCap. V11 doesn't expose a regionalization input in the Cedar Grove model — Cedar Grove's $12,613 BEA rate is either *already* regionalized or independent of it. Until Session 2 resolves the SSE-in-BEA question (V11 analysis §7), this is ambiguous.

For this fixture I left regionalization at 1.030 and entered V11's $12,613 directly. SchoolLaunch's effective per-pupil is **$12,613 × 1.030 = $12,991** — already $378/pupil higher than V11's stated rate, contributing to the gap.

---

## 10 · UI bugs / surprises encountered

### 10.A — Signup form requires number or symbol in password
The brief specified password "excellent". The form's policy requires "Contains a number or symbol". Resolved by using `excellent!` after asking; original password would have been silently disabled.

### 10.B — Staffing tab inline title edit doesn't persist
Editing the position title text input via the dashboard Staffing tab does not save to the database. Salary and FTE inputs on the same row do save. See §6.

### 10.C — Dashboard crashes when `startup_funding` JSON has unexpected shape
After populating `school_profiles.startup_funding` via Supabase MCP with shape `[{id, name, amount, type, status, year_allocations: {y0, y1, y2, y3, y4}}]`, the dashboard Overview page crashed with:

```
TypeError: Cannot read properties of undefined (reading 'localeCompare')
  at canonicalizeProjectionInputs
  at computeAdvisoryHash
  at DashboardPage.useMemo[currentDataHash]
```

The error boundary caught it, but the entire dashboard was unrenderable. Resolved by reverting `startup_funding` to `[]`. This is a **defensive-programming gap** in the advisory-hash canonicalizer: it sorts items by a string field that doesn't exist on the JSON shape I used. The exact field name isn't visible in the minified stack. **A real user editing startup funding through the Startup Funding UI is presumably safe** — the UI sets the canonical shape. But any data-import or migration path that builds startup_funding JSON differently can brick the dashboard. Worth a Session 2 follow-up: identify the canonical shape and either tighten the schema or harden the sort comparator.

### 10.D — Advisory briefing is stale after bulk DB changes
After SQL-inserting 23 staffing positions, the Overview's Advisory Briefing section still describes "18 total staff members" and warns about understaffing. The briefing cache has a stale-detection banner ("Your financial model has changed since the last briefing — click Refresh for updated analysis"), so this is *known behavior*, not a bug — but the screenshot deliverable captures the stale briefing. Refresh was not triggered to avoid blowing API tokens. Session 2 should refresh.

### 10.E — Onboarding's "Staffing" lite step seeds 6 default positions
Onboarding's Staffing step seeds 6 default positions (CEO, Principal, Classroom Teacher Elementary @ 10 FTE, SPED Teacher, Admin Assistant, Paraeducators @ 4 FTE) regardless of which positions you actually want. To enter a 23-position V11 plan, you must delete the defaults on the dashboard Staffing tab and re-add. There's no "import from V11" or "clear and restart" affordance.

### 10.F — Onboarding completion page blanks for ~5 seconds
After clicking "Complete Onboarding", the screen goes blank with no visible spinner for several seconds before redirecting. I waited and it eventually landed at /dashboard, but a user could reasonably assume the click failed and refresh, possibly creating a duplicate state.

---

## 11 · What this fixture has now in Supabase

- `schools` row: 1 (UUID `63fedd25-90b0-4078-9854-7ec7071e0fb2`)
- `school_profiles`: onboarding_complete = true, retention 100 %, salary_esc 3 %, all per-pupil rates set per §3
- `staffing_positions`: 115 rows (23 positions × 5 years)
- `budget_projections`: 25 rows (seeded by onboarding's `complete` handler)
- `grade_expansion_plan`: present (via grade-expansion table — count not enumerated in this session)
- `startup_funding`: **empty** (reverted due to §10.C). Philanthropy and CSP not currently entered.
- `advisory_cache`: stale (predates bulk staffing changes)
- `custom_revenue_lines`: empty (default; not used)

Y1 dashboard Overview (the screenshot):
- 240 students, Y1
- $4,127,717 total operating revenue
- $2,605,655 total personnel (27.25 FTE incl 30 % benefits)
- $697,520 total operations
- $824,542 net position, 91 days cash
- All FPF Stage 1 / Stage 2 metrics rendering "Meets" except Personnel % which renders "Approaching low"

---

## 12 · Blockers for Session 2

None hard. Soft items to confirm before Session 2 begins:

1. **Per-position FTE truth.** §6 — does the V11 spreadsheet itself sum to 25.75 (suggesting some position FTE in the brief is too high) or to ~27.25 (suggesting the brief's total is the wrong number)? Need to read the V11 STAFFING sheet directly.
2. **SPED Apportionment field semantics.** §3, §4 — is SchoolLaunch's `sped_per_pupil` ($455 entered) the equivalent of OSPI 3121, or of OSPI 4121, or a combination?
3. **Whether `Cedar Grove's $12,613` is regionalized.** §9 — if it's the de-regionalized rate, SchoolLaunch's auto-multiplier overcounts. If it's already-regionalized, leave alone.
4. **Startup_funding canonical JSON shape.** §10.C — read the source for `canonicalizeProjectionInputs` to learn the expected shape, then re-enter philanthropy and CSP grant.
5. **Decide on philanthropy ($250K Y1, $300K Y2-Y5) and CSP ($400K Y2-Y5) entry path.** Either through the Revenue page "Startup & Other Grants — Funding Sources" UI (preferred), or via the now-known canonical JSON shape. Without these, Y1 revenue is understated by $250K and Y2-Y5 each by ~$700K.

---

## 13 · Quick reference

```
School UUID:   63fedd25-90b0-4078-9854-7ec7071e0fb2
Email:         cedar-grove-v11@schoollaunch.test
Password:      excellent!  (modified from "excellent" per §10.A)
Dashboard URL: http://localhost:3000/dashboard
School name:   Cedar Grove Public Schools - V11 Test
Pathway:       wa_charter
State:         WA
School type:   charter
County:        Spokane County (regionalization 1.030×)
Opening year:  2027 (Y0 FY27 pre-opening, Y1 FY28 = first operating year)
```

End of Session 1 report.
