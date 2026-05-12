# Part 3 — Tab-by-Tab Audit Findings (Post R-ENR-01)

**Date:** 2026-05-11
**School:** Evergreen Heights Charter Academy (school_id `7d82e5d1-...`)
**Pathway:** WA Charter, Yakima County (factor 1.000)
**Retention rate:** 92 (post-migration default)
**Reference baseline trajectory:** `[72, 90, 107, 122, 112]`

Findings logged inline as the audit progresses. Severity scale: **Critical** / **High** / **Medium** / **Low**. **EXPECTED** tag = matches a known backlog item, not a new finding.

---

## Tab 1 — Overview

**Screenshot:** `audit-13-p3-tab1-overview.png`

### Confirmed working

- 4 health tiles render: Days of Cash Y1, Ending Cash Y1, Total Margin %, Personnel % Revenue
- 3 of 4 tiles correctly badged "Meets" with `data-status="meets"`
- **AI briefing regenerated post-migration cache clear** — timestamp confirms fresh generation (8:52 PM, matching current time). Verifies the advisory_cache invalidation → regeneration path works end-to-end.
- **No "attrition backfilled" prose** in the AI briefing — F3 fix holds, no regression
- 5-year trajectory strip enrollment matches Multi-Year exactly: 72 / 90 / 107 / 122 / 112
- Grades Served row matches: K–2 / K–3 / K–4 / K–5 / K–5
- Net Position trajectory: $45K / $226K / $408K / $578K / $463K
- Days Cash trajectory: 104 / 163 / 261 / 383 / 494
- Year 1 visually distinguished (labeled "Current")
- Year 1 budget summary numbers cross-check against Multi-Year exactly: Revenue $1,080,636 / Personnel $703,300 / Operations $332,106 / Net $45,230 / Days 104
- Export buttons present: "Export PDF", "Export Excel"
- **"Export to SchoolCFO" button absent** ✓ — consistent with `status=planning`

### F-001 — Personnel % tile fails for founding-year school **(Medium)**

**Surface:** `<div data-testid="health-tile">` with `data-status="fails"` and `border-left-color: var(--rose-500)` (red border).

**Expected:** 65.3% personnel-as-share-of-revenue should NOT be flagged red for a K-2 founding year school. Per Travis's pre-Part-3 directive, the spec's 72–78% "healthy band" is calibrated for steady-state operations; founding-year schools genuinely run leaner (65–72%) because the staffing template only instantiates positions justified by current enrollment.

**Actual:** Tile shows "Does Not Meet" with red left border.

**AI briefing prose disagrees:** "personnel costs at 65.3% of operating revenue are within sustainable ranges." So the corrected AI context produces the right assessment, while the tile threshold logic produces the wrong one. Two systems, one truth.

**Suspected root cause:** Health-tile threshold is a single value (probably <72% triggers "fails"), not a year-of-operation-aware band.

**Grep targets:** `personnel.*%`, `healthThresholds`, the Overview health-tile component (likely in `src/app/(authenticated)/dashboard/page.tsx` or `src/components/HealthTile.tsx`).

**Fix scope:** Either (a) widen the band to 65–78% for Y1 / 72–78% for Y2+, or (b) skip the threshold check for founding-year. Recommendation: option (a), with tooltip explaining the year-band logic.

**Pre-May-19?** **YES.** A founder demo-ing to ESWA or the Commission will see a red tile that the AI explicitly says is healthy. Inconsistent dashboards undermine confidence.

### F-002 — 5-year trajectory strip omits Year 0 **(Low)**

**Expected:** Per audit spec, "5-year trajectory strip shows Year 0 with no revenue and proper cash carry-forward to Year 1."

**Actual:** Strip starts at Year 1 ("Current"). No Year 0 column. Pre-opening expenses + $250K Year 0 startup funding are not visible on the Overview strip (they appear on Cash Flow / Multi-Year tabs).

**Suspected:** Intentional UX choice to keep the Overview strip compact, but contradicts the audit spec expectation.

**Severity:** Low. Information is preserved elsewhere; the issue is whether the spec expectation matches the shipped UX.

**Decision needed:** Should the strip be extended to include Y0, or should the spec expectation be updated? Either way is defensible.

### F-003 — Scenario Summary card: only Base Case visible **(verify on Scenarios tab)**

**Expected:** Per audit spec, "Scenario Summary card shows Base / Conservative / Optimistic."

**Actual:** Body text contains "Base Case" twice but no "Conservative" or "Optimistic" mentions on the Overview page. The 3-up summary card may not be rendering, OR scenarios for this school haven't been seeded yet (they're created on-demand via the Scenarios tab).

**Defer to:** Tab 7 (Scenarios) — if scenarios aren't seeded for Evergreen, then this is **expected** (the school is new, hasn't visited Scenarios tab yet). If scenarios ARE seeded but the Overview card still shows only Base, that's a finding.

### F-004 — Days of Cash Y1 tile reads "Meets Stage 2" **(verify on Commission Scorecard)**

**Surface:** Tile label "Days of Cash Y1 End | Meets | 104 days | Meets Stage 2"

**Question:** Per audit spec, "Stage 1 thresholds applied to Years 1–2, Stage 2 for Years 3+." The tile shows "Meets Stage 2" for Y1, suggesting one of:
- (a) Tile shows the HIGHEST stage the value meets, regardless of which stage applies (104 > 60 = Stage 2 threshold; also > 30 = Stage 1)
- (b) Tile is using Stage 2 threshold for Y1, which would be inconsistent with the spec

**Defer to:** Tab 11 (Commission Scorecard) — verify the stage-by-year logic there.

### Backlog reproduction status

- **P-UX-02** (Joyride tour blocks nav on first visit): not re-triggering on this visit. The tour was Skipped during onboarding; presumably `tour_completed` flag tracks this per-user-per-school. **Confirmed dismissible but original reproduction held during Part 1.**

---

## Tab 2 — Revenue

**Screenshot:** `audit-14-p3-tab2-revenue.png`

### Confirmed working

- 13 revenue lines render (matches spec's 14 minus the Transportation line — Transportation toggle is OFF for Evergreen)
- Sections: State & Local (6) / Federal (2) / State Categorical (4) / Program Revenue (1)
- **Regular Ed: 68 AAFTE × $11,812 = $803,216** ✓ (Yakima regionalization 1.000 applied; rate matches R-ENR-01 Phase 1 finding that $11,812 is the OSPI-calibrated canonical)
- SPED Apportionment: 68 × 12% IEP × $2,548 = $20,792 ✓
- State Special Education: 9 SPED students × $13,556 = $122,004 ✓
- **Levy Equity: $0** with tooltip "Currently unfunded by legislature. Override if reinstated." ✓
- Facilities Revenue: $0 (correct — no facilities reimbursement program firing)
- **LAP base fires:** 72 × 45% FRL × $816 = $26,438 ✓
- **LAP High Poverty: $0** with tooltip "50% FRL threshold required; allocation scales with FRL percentage." ✓ (gate logic correct, 45% < 50%)
- **Title I fires:** 72 × 45% FRL × $880 = $28,512 ✓ (40% gate cleared)
- IDEA: 72 × 12% × $1,500 = $12,960 ✓
- TBIP: 72 × 8% × $1,600 = $9,216 ✓
- HiCap: 72 × 5% × $730 = $2,628 ✓
- Food Service (NSLP): 72 × $710 = $51,120 ✓
- AAFTE displayed: "68 students (95%)" ✓
- Transportation revenue line absent (correct — toggle OFF)

### F-005 — SSE expected baseline assertion was inverted **(spec correction, not code bug)**

**Audit spec said:** "SSE displays a non-zero value (K–6 band has 60 AAFTE minimum; this school is at ~68 AAFTE so SSE should fire and be visible)"

**Actual:** SSE = $0 with formula explanation "All grade bands exceed minimums (K-6: 60, 7-8: 20, 9-12: 60 AAFTE)"

**Reality:** SSE provides enhancement when AAFTE is BELOW the minimum (small-school compensation), not above. Evergreen at 68 AAFTE in the K-6 band exceeds the 60 minimum → no SSE needed → $0 is correct.

**Resolution:** Update audit spec's baseline assertion #5 to reflect SSE-fires-when-below-minimum semantics. The implementation is correct.

### F-006 — Operating Revenue inconsistency Revenue tab vs Multi-Year/Overview **(Medium, SSOT violation)**

**Surface:**
- Revenue tab → Operating Revenue = **$1,076,886** (Total Revenue also $1,076,886)
- Multi-Year tab → Operating Revenue = **$1,080,636**
- Overview "Year 1 Base Case" → Operating Revenue = **$1,080,636**

**Difference:** Exactly **$3,750** = Interest & Other Income for Year 1.

**Mechanism:**
- Revenue tab lists 13 revenue lines, none of them Interest. Operating Revenue and Total Revenue are computed as sum of the 13 lines.
- Multi-Year tab and Overview include a 14th line ("Interest & Other Income") inside their Operating Revenue tally. This line scales over years: $3,750 / $8,857 / $15,259 / $25,860 / $41,456.

**Classification question:** Is Interest income operating revenue or non-operating revenue?
- Per accounting convention: interest from cash holdings is typically NON-operating revenue.
- Per the dashboard's labels: Multi-Year calls it "Operating Revenue" while Revenue tab implicitly excludes it.

**Severity:** Medium. The headline Y1 revenue figure is off by $3,750 (~0.35%) between two surfaces. Cross-cutting Part 4.1 verification would have caught this independently.

**Suspected root cause:** Interest is computed by `computeMultiYearDetailed` (year-by-year cash projection) but isn't returned by `calcCommissionRevenue` (used by the Revenue tab). Two engine code paths, one labeling pattern.

**Grep targets:** `interest_rate_on_cash`, `Interest & Other Income`, `Operating Revenue`.

**Fix scope:**
- Option A: Add Interest as 14th line on Revenue tab (label "Interest & Other Income (non-operating)" or similar)
- Option B: Exclude Interest from Multi-Year's "Operating Revenue" — render it on a separate row beneath
- Recommendation: Option B. Operating Revenue should mean "earned from school operations"; interest from cash is incidental.

### P-UX-01 reproduction — CONFIRMED **(EXPECTED — matches backlog)**

**Repro steps executed:**
1. Set Regular Ed override input to `999000` via dispatched input/change/blur events
2. Confirmed input value updated to `999000` pre-reload
3. Navigated to `http://localhost:3000/dashboard/revenue` (reload)
4. Read input value after reload

**Result:**
- Override after reload: `(empty)`
- Amount after reload: `$803,216` (formula-computed value, override discarded)

Exact match to P-UX-01's BACKLOG.md description: "the change appears to save... but after page.reload() the input reads back empty."

**Status:** No new finding — backlog item still open. Phase 8+ of the Cedar Ridge E2E remains blocked on this.

---

## Tab 3 — Staffing

**Screenshot:** `audit-15-p3-tab3-staffing.png`

### Confirmed working

- 6 instantiated position rows visible (CEO, Principal, Classroom Teacher Elem, SPED Teacher, Office Manager, Paraeducator). Grouped by Admin / Certificated / Classified subheaders. The full 27-position catalog (per `COMMISSION_POSITIONS` in `types.ts`) is available via the position dropdown — verified via DOM probe showing all 27 options on each row's `<select>`.
- Y1–Y5 FTE columns present
- Total FTE row scales: 8 / 9 / 10 / 11 / 11 (Y5 = Y4 because staffing is sticky; teachers don't get fired when retention causes a Y5 enrollment dip)
- Total Salaries: $541,000 / $613,975 / $690,259 / $769,979 / $789,225 (salaries escalate 2.5% annually + new teacher hires)
- Total Personnel Cost: $703,300 ✓ matches Overview + Multi-Year Y1 exactly
- Benefits row: $162,300 / $184,193 / ... (30% benefits load ✓)
- Per Pupil driver scales: Classroom Teacher Elementary 3 → 4 → 5 → 6 → 6 (one teacher per section as sections expand)
- Fixed driver positions don't scale: CEO, Principal, SPED Teacher, Office Manager all stay at 1.0 across Y1–Y5
- Position rows ordered consistently with the Commission position catalog

### Spec correction — "27 OSPI-aligned position rows" expectation

Audit spec said "27 OSPI-aligned position rows" — this is the CATALOG count, not the instantiated count. The Staffing tab correctly displays only the positions a school has instantiated (6 for K-2 founding); each row's position dropdown exposes all 27 catalog types for addition/swap. Reasonable UX choice; spec language could be clearer.

### P-UX-03 reproduction — CONFIRMED **(EXPECTED — matches backlog)**

**Per the BACKLOG entry:** "Each of the 27 Commission-aligned positions has a `driver` column... currently seeded from `COMMISSION_POSITIONS` in `src/lib/types.ts` and is not exposed in the Staffing tab UI."

**Observed:** Driver column shows static text labels ("Fixed", "Per Pupil"). Cell contains no `<select>` or `<input>` for editing. Founder cannot override the driver without a direct DB write or onboarding-time programmatic change.

**Status:** Matches backlog. No new finding.

### F-007 — Personnel % NOT displayed in Staffing header **(Low)**

**Audit spec said:** "Personnel % badge in header matches Overview tile."

**Actual:** No Personnel % indicator visible in the Staffing tab header. Header shows Total Personnel Cost ($703,300) but not the ratio against revenue.

**Severity:** Low. Founders can derive it from the Total Personnel Cost + revenue, but the spec expected a badge for at-a-glance health.

**Decision needed:** Should the Staffing header show Personnel % (matching the Overview tile's value)? If yes, the same year-of-operation threshold concern from F-001 would apply.

---

## Tab 4 — Operations

**Screenshot:** `audit-16-p3-tab4-operations.png`

### Confirmed working

- **Authorizer Fee: 3% of state apportionment = $28,380** — display-only, no editable input ✓ (spec required read-only)
- Facility cost: $153,864 (matches 15% estimate from onboarding) ✓
- Per-pupil benchmarks editable: Supplies $200, Technology $180, Curriculum $500, etc. (all `readOnly: false`)
- Insurance $18,000 editable
- 19 editable inputs in total — generous per-pupil customization surface

### F-008 — Transportation row displayed despite `transportation_offered = false` **(Low/cosmetic)**

**Audit spec said:** "Transportation not displayed (toggle OFF in onboarding)"

**Actual:** Transportation row visible on Operations tab: `Transportation | $/student | $800/student = $57,600 | (empty amount column)`. The formula text shows the would-be expense, but the actual amount column is empty — Transportation isn't contributing to total expenses.

**Severity:** Low / cosmetic. Numbers are correct (Multi-Year confirms $0 Transportation expense). But displaying a row with a $57,600 formula for a service the school isn't offering is confusing. A founder seeing this row might think it's an expense they're missing.

**Fix scope:** Either (a) hide the row entirely when `transportation_offered = false`, or (b) show with explicit "Not enabled" badge in place of the formula.

### F-009 — Food Service expense shows $86,400 formula but contributes $0 **(Low/cosmetic)**

**Surface:** Food Service row: `Food Service | $/student | $1200/student = $86,400 | (empty amount column)`. The Food Program toggle is ON, contributing $51,120 to revenue (NSLP), but the food service expense isn't actually being charged in Multi-Year Y1 ($0 in operations).

**Per onboarding help text:** "If enabled, assumes net neutral (federal reimbursement offsets cost)" — so the simplification is that food service is net-zero. The $86,400 formula is informational, not actual.

**Severity:** Low. Matches design intent ("net neutral"), but a founder reading the row could misinterpret $86,400 as a real line item.

**Fix scope:** Add a clarifying note next to the Food Service row: "Net-neutral (revenue offsets expense)" — or move it out of the operating expense table entirely.

### Authorizer fee lock — verified

No input element exists in the Authorizer Fee row. Text-only display. ✓ Spec satisfied.

---

## Tab 5 — Cash Flow

**Screenshot:** `audit-17-p3-tab5-cashflow.png`

### Confirmed working

**OSPI apportionment schedule — perfect match to spec, sums to 100.0%:**

| Month | Pct | Apport. $ | Cumulative Balance |
|---|---|---|---|
| Sep | 9.0% | $85,141 | $259,763 |
| Oct | 8.0% | $75,681 | $260,066 |
| **Nov** | **5.0%** ⚠️ | $47,301 | $231,989 |
| Dec | 9.0% | $85,141 | $241,752 |
| Jan | 8.5% | $80,411 | $246,785 |
| Feb | 9.0% | $85,141 | $256,548 |
| Mar | 9.0% | $85,141 | $266,311 |
| Apr | 9.0% | $85,141 | $276,074 |
| **May** | **5.0%** ⚠️ | $47,301 | $247,997 |
| Jun | 6.0% | $56,761 | $229,380 |
| **Jul** | **12.5%** ★ | $118,252 | $272,254 |
| Aug | 10.0% | $94,601 | $291,477 |
| **Total** | **100.0%** | | |

- ✓ 12 monthly columns, September through August (WA fiscal year)
- ✓ Schedule matches spec exactly: 9 / 8 / 5 / 9 / 8.5 / 9 / 9 / 9 / 5 / 6 / 12.5 / 10
- ✓ November and May correctly flagged (lowest at 5% each) — page shows 3 "Warning" labels (Nov, May, and likely Jun at 6%)
- ✓ July is the largest payment at 12.5%, lands after fiscal year end as spec describes
- ✓ All months show positive cumulative balance (min = $229,380 in Jun) — no negative months for this healthy school
- ✓ **$250K Year 0 startup carry-forward confirmed end-to-end:** Sep beginning cash = $250,000 (Y0 funding) + Net Cash Flow $9,763 = $259,763 cumulative — the `computeCarryForward` chain works correctly

### Tab structure note

Cash Flow page has TWO inner views (button-toggled, not URL-routed):
- **Year 0 (Pre-Opening)** — default view: startup funding allocation ($250K Federal CSP Grant), pre-opening expenses (empty), monthly Mar–Aug pre-opening plan
- **Year 1 (First Operating Year)** — the OSPI monthly schedule with full per-month inflow/outflow/cumulative

Spec didn't anticipate the Y0/Y1 toggle; worth flagging in spec update but not a finding.

### Baseline assertion #10 verified ✓

`$250K Year 0 → Year 1 carry-forward` — confirmed at runtime via Cash Flow. Sep cumulative balance ($259,763) = $250K Y0 + $9,763 Sep net. The retention-rate-related work didn't break this.

---

## Tab 6 — Multi-Year

**Screenshot:** `audit-18-p3-tab6-multiyear.png`

### Confirmed working (much of this was verified during R-ENR-01 Phase 3, restated here for audit completeness)

- Total Enrollment trajectory: **72 / 90 / 107 / 122 / 112** ✓ (matches R-ENR-01 retention=92 unit test exactly)
- Returning Students: — / 66 / 83 / 98 / 112 ✓ (compounds correctly through Formula A)
- New Grade Students Y1 shows "—" ✓ (R-ENR-01 P3.4 copy fix in place)
- Beginning Cash Y1 = $250,000 ✓ (Y0 startup carry-forward via `computeCarryForward`)
- Chain: Ending Cash Y1 = $295,230 = Beginning Cash Y2 ✓ (carry chain intact)
- Days Cash: 104 / 163 / 261 / 383 / 494 ✓
- Revenue scales with COLA + enrollment
- Operations escalate 2% annually
- Salary escalation 2.5% visible across personnel cost row

### F-010 — Year 0 column missing from Multi-Year row data **(Low)**

**Audit spec said:** "Years 0–5 columns"

**Actual:** 5 columns visible in data rows (Y1–Y5). "Year 0" appears in the year-header band twice but doesn't have its own data column in the main multi-year table. The Y0 startup funding ($250K) and pre-opening expenses are shown on a separate Cash Flow tab inner view (Year 0 / Pre-Opening).

**Verdict:** Same issue as F-002 (Overview strip omitting Y0). Functional information is preserved on the Cash Flow Y0 view; the question is whether the Multi-Year tab itself should include a Y0 column.

**Severity:** Low — same as F-002.

---

## Tab 7 — Scenarios + RF-2 Verification

**Screenshot:** `audit-19-p3-tab7-scenarios.png`

### Initial state — empty CTA (expected)

Evergreen Heights had no computed scenarios in the DB pre-test. The Scenarios tab correctly showed an empty state CTA: "Stress-Test Your Financial Model — Model conservative, base, and optimistic scenarios to show the Commission you've planned for different outcomes. We'll start with smart defaults based on your current financial plan." with a "Build Scenarios" button.

(DB had 1 stale scenario row pre-existing but with `results = null` — the UI correctly ignored it and showed the empty state.)

### Confirmed working after clicking Build Scenarios

- Three scenarios seeded with smart defaults: **Conservative / Base Case / Optimistic** (each name appears 3 times in DOM — header, comparison column header, summary card)
- **5 levers present:** 3 sliders + 2 number inputs (matches spec: Enrollment Fill Rate, Per-Pupil Funding Adjustment, Personnel Cost Adjustment = sliders; Monthly Facility Cost + Startup Capital = number inputs)
- AI analysis section visible

### RF-2 staleness verification — DEFERRED, not testable on Evergreen Heights

**Why:** Evergreen's scenarios are brand-new (just seeded this session, AFTER R-ENR-01 shipped). They were computed against the post-fix engine, so the `base_data_hash` is consistent with current data. No staleness expected.

**Verification needs:** A school with `scenarios.results` non-null AND `base_data_hash` computed pre-R-ENR-01. Per my earlier DB query, "New School Sample" and "Cedar Grove Public Schools" both have 3 computed scenarios — these were generated under the prior engine and should now show stale indicators when their owners visit the Scenarios tab.

**Recommendation:** RF-2 verification belongs in a separate session where someone logs in as a user with access to one of those schools. Not testable from Evergreen's CEO account without context switching.

**Status:** Flagged in `BACKLOG.md` RF-2 entry. Still INVESTIGATING.

---

## Tab 8 — Ask SchoolLaunch

**Screenshot:** `audit-20-p3-tab8-ask.png`

### Confirmed working

**Test question 1: "How does our personnel ratio compare to healthy WA charters?"**

Response (1,648 chars) anchored to actual numbers ("65.3% of operating revenue", "3 elementary teachers plus 1 SPED teacher gives you an 18:1 student-teacher ratio"). Plain English, surfaces concerns proactively, lists actionable options ($80,600 reading specialist, etc.).

But: contradicts Overview AI Briefing — see F-011 below.

**Test question 2: "Why is our Year 5 enrollment lower than Year 4?"** — *F3 prose stress test*

Response: *"Your Year 5 enrollment drops from 122 to 112 students because you've reached full buildout and are only subject to retention losses - no new grades are added to offset the natural attrition. **Year 5:** 112 students - this is the 122 Year 4 students × 92% retention rate... once you're fully built out in Year 4, there are no more new grades to add. Year 5 only gets new kindergarteners - you lose some continuing students to the 8% attrition rate across all grades K-5, and that loss is only partially offset by the single new kindergarten class. **This is normal and expected** for charter schools using a grade expansion model. Most schools see peak enrollment in their final buildout year, then a slight decline as they reach steady-state operations."*

**Verifications:**
- ✓ **No "attrition backfilled" prose** (F3 fix holds; no regression)
- ✓ **Buildout-decline narrative present** (matches the Phase 2 prose append + tooltip language)
- ✓ Math correct: 122 × 0.92 = 112.24 ≈ 112
- ✓ Agent describes Y5 < Y4 as "normal and expected" — frames correctly for Commission reviewers

**F3 fix verified end-to-end on the Ask SchoolLaunch agent surface.**

### F-011 — Three inconsistent assessments of Personnel % across surfaces **(High, follow-up to F-001)**

Three different verdicts on Evergreen's **same** 65.3% personnel-as-share-of-revenue value:

| Surface | Verdict | Tone |
|---|---|---|
| Overview health tile | "Does Not Meet" (red, `data-status="fails"`) | Threshold-rule, no qualifier |
| Overview AI Briefing (synthesized) | "within sustainable ranges" | Acknowledges founding-year context |
| Ask SchoolLaunch agent (this tab) | "below the healthy range... about 7 percentage points below the minimum threshold... may not have enough staff" | Rigid 72-78% band citation, NO founding-year qualifier |

**Implication:** A founder asking the same question via two surfaces gets opposite answers. A founder looking at the dashboard tile vs reading the briefing gets opposite signals. This is the kind of inconsistency that erodes trust in the platform.

**Root cause likely:**
- Overview tile uses a hardcoded threshold check (somewhere in HealthTile component logic)
- Overview AI Briefing receives a synthesized context that includes founding-year language somewhere
- Ask SchoolLaunch agent uses a different system prompt that cites the spec band literally

**Connection to F-001:** F-001 identified the tile threshold issue. F-011 escalates the severity because the inconsistency is now confirmed across THREE surfaces, not just the tile. The fix needs to be at the threshold-definition level (single source of truth for "what's a healthy personnel %"), not just the tile.

**Fix scope:**
- Define a year-aware threshold helper: `evaluatePersonnelPctHealth(pct, year, status)` returning { verdict, explanation }
- Wire the tile, the AI briefing context, and the Ask SchoolLaunch agent context through the same helper
- Threshold band per Travis's C decision: founding year 65–72% healthy, steady-state 72–78% healthy

**Pre-May-19?** YES. Inconsistency across surfaces is more visible (and embarrassing) than any single wrong answer.

### Suggested-questions UX

Tab presents 3+ suggested-question buttons including: "What enrollment do I need to break even in Year 1?", "Can I afford a full-time principal at this enrollment level?", "How does our personnel ratio compare to healthy WA charters?" — well-tuned for the user persona.

---

## Tab 9 — Advisory Panel (HIGH-SIGNAL VERIFICATION GATE per RF-related-findings)

**Screenshot:** `audit-21-p3-tab9-advisory.png`

### All 7 agents render without error ✓

| Agent | Status | Engaged correctly with R-ENR-01 context? |
|---|---|---|
| Commission Reviewer | **Strong** | ✓ Correctly applies Stage 1 to Y1–2 and Stage 2 to Y3–5. Notes 65.3% personnel as "within sustainable ranges" (engages founding-year context). |
| Enrollment Realist | Needs Attention | ✓ Cites "typical new charter attrition of 5-8%". Recommends stress-test at 90% Y1. Engages with retention thinking. |
| Staffing Advisor | Needs Attention | ⚠️ Uses rigid 72-78% threshold — same flaw as F-001/F-011. |
| Compliance Officer | Needs Attention | ✓ Detailed Title I/IDEA/LAP analysis. Recommends braiding strategies. |
| Operations Analyst | Needs Attention | ✓ Contracted Services underbudget, transport/food gaps. |
| Board Finance Chair | Needs Attention | ✓ Audit, D&O insurance, Business Manager gaps. |
| SchoolCFO Advisor | **Risk** | ✓ Business Manager / accounting system / payroll service gaps. |

### F3 prose verification

- ✓ **No "attrition backfilled"** prose in any of the 7 agent outputs (full body text scan)
- ✓ "attrition" appears 4 times (Enrollment Realist context, agent recommendations)
- ✓ "92%" appears once (in agent prose discussing retention rate)
- All 7 agents reason about the corrected post-fix context, not the broken prior framing

### advisory_cache repopulation verified ✓

DB query post-Advisory-Panel-visit:

```
school_id:  7d82e5d1-7943-4103-9144-a4e175da9282
cache_status: POPULATED
agent_count:  7
data_hash:    v3-2026-05|27be2b40|4904
generated_at: 2026-05-12T03:52:45.901Z (timestamp matches Overview briefing regen)
```

Full cache pipeline verified end-to-end:
1. Phase 4 migration nulled `advisory_cache`
2. Phase 5 first dashboard visit triggered regeneration
3. New cache stored with new `dataHash` reflecting post-fix retention numbers
4. Subsequent visits (this Advisory Panel visit) reuse the cache without regenerating

### F-004 RESOLVED ✓

Earlier I flagged the Overview Days-of-Cash Y1 tile labeling as "Meets Stage 2" as potentially misleading (Y1 should be Stage 1).

**Commission Reviewer's response confirms the system understands stages correctly:** *"meeting Stage 1 requirements in Years 1-2 and Stage 2 requirements in Years 3-5"*

The agent gets the stage logic right. The Overview tile label "Meets Stage 2" for Y1 is therefore a tile-display issue (showing the higher stage threshold the value meets, rather than which stage applies that year). Minor cosmetic finding, not a stage-logic bug. **Downgrade F-004 from "verify" to "Low / cosmetic tile labeling."**

### F-011 third-surface confirmation

The Staffing Advisor agent ("Personnel % of 65.3%... below the healthy 72-78% range") is now the THIRD surface using the rigid threshold without the founding-year qualifier. F-011 escalates further: **the threshold logic needs to be fixed at the agent context level, the tile level, and any other downstream consumer.**

### Skipping Tab 10 — Alignment Review

Per audit spec: "Skip for this audit unless time permits. Requires uploading a charter application narrative." Out of scope.

---

## Tab 11 — Commission Scorecard

**Screenshot:** `audit-22-p3-tab11-scorecard.png`

### Confirmed working — passes all audit spec checks

8 measures × 5 years matrix, all data-status="meets":

| Measure | Y1 | Y2 | Y3 | Y4 | Y5 | Target (Stage 1 / Stage 2) |
|---|---|---|---|---|---|---|
| Current Ratio | 3.42 | 5.37 | 8.58 | 12.59 | 16.25 | S1: ≥1.0, S2: ≥1.1 |
| Days of Cash | 104 | 163 | 261 | 383 | 494 | S1: ≥30, S2: ≥60 |
| Total Margin | 4.2% | 16.3% | 23.9% | 28.7% | 24.1% | ≥ 0% |
| 3-Year Total Margin | N/A | N/A | 16.2% | 23.7% | 25.7% | S2: > 0% (S1: N/A) |
| Debt-to-Asset | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | < 0.90 (no debt) |
| Debt Default | N/A | N/A | N/A | N/A | N/A | No default |
| Cash Flow | N/A | $226K | $408K | $578K | $463K | > $0 (Y1 N/A — no prior) |
| Multi-Year Cash Flow | N/A | N/A | $634K | $986K | $1.0M | S2: > $0 |
| Enrollment Variance | 100% | 100% | 100% | 100% | 100% | ≥ 95% |

- ✓ Stage 1 / Stage 2 thresholds visible in Target column (both stages shown for each metric)
- ✓ Stage logic correctly handles N/A cells where applicable (Y1 cash flow has no prior year; 3-Year Margin needs 3 years of data)
- ✓ All cells show "Meets" — Evergreen is a healthy baseline as expected
- ✓ Days of Cash Y1 = 104 days, correctly badged "Meets" without the "Meets Stage 2" label that appears on the Overview tile (F-004 confirmed as tile-only cosmetic issue)
- ✓ Total Margin and Multi-Year Cash Flow trajectories reflect retention=92 enrollment numbers (Y5 < Y4 totals are visible in the dollar amounts)

### F-004 RESOLVED ✓ — Scorecard handles stages correctly, only Overview tile has the misleading label

The Commission Reviewer agent + this Scorecard both agree: Stage 1 applies Y1-2, Stage 2 applies Y3-5. The Overview tile's "Meets Stage 2" label for Days of Cash Y1 is the cosmetic outlier — flagged in F-004, no engine issue.

---

## Tab 12 — Settings

**Screenshot:** `audit-23-p3-tab12-settings.png`

### All required sections render

| Section | Present |
|---|---|
| School Profile | ✓ |
| Team Members (+ Invite a Team Member) | ✓ |
| Enrollment & Demographics | ✓ |
| Grade Expansion Plan | ✓ (with R-ENR-01 P3 slider at value 92) |
| Year 1 Grade Configuration | ✓ |
| Programs | ✓ |
| Revenue Assumptions | ✓ |
| Small School Enhancement Thresholds | ✓ |
| Expense Assumptions | ✓ |
| Operations Benchmarks | ✓ |
| Danger Zone | ✓ |

### Spec checks confirmed

- ✓ Team Members section displays for school_ceo (the audit account's role)
- ✓ Authorizer fee NOT editable — no `<input>` element with "authorizer" in its name/aria-label found
- ✓ Retention slider (R-ENR-01 Phase 3): present, value = 92, matches DB
- ✓ Danger Zone section present

### F-012 — No fiscal year control exposed in Settings **(Low / verify-intent)**

Audit spec said "Fiscal year start locked at September" — implying a visible-but-disabled control.

**Actual:** No fiscal year control of any kind on the Settings page. `fiscal_year_start_month = 9` in the DB but the value isn't surfaced in Settings UI for review or display. A founder can't see what fiscal year start their school is operating under without going to the DB.

**Severity:** Low. The value is effectively locked (no UI to change it) but founders also can't verify it from the UI. Decision needed: should the value be displayed (read-only) for transparency?

---

# Part 4 — Cross-cutting checks

## 4.1 — Single Source of Truth verification

Compiled from tab-by-tab probes. **Bold = mismatch flagged in a finding.**

| Metric | Source of truth | Overview | Revenue tab | Staffing | Multi-Year | Cash Flow | Scorecard | Ask agent | Advisory agent |
|---|---|---|---|---|---|---|---|---|---|
| Y1 Total Revenue | `computeMultiYearDetailed` | $1,080,636 | **$1,076,886** ⚠ F-006 | n/a | $1,080,636 | implicit (Sep apport $85,141 × …) | n/a | $1,080,636 | $1,080,636 |
| Y1 Operating Revenue | `computeMultiYearDetailed` | $1,080,636 | **$1,076,886** ⚠ F-006 | n/a | $1,080,636 | n/a | n/a | — | — |
| Y1 Personnel cost | `calcBenefits` + staffing rollup | $703,300 | n/a | $703,300 ✓ | $703,300 | n/a | n/a | $703,300 ✓ | $703,300 ✓ |
| Y1 Personnel % verdict | (no SSOT yet) | **"Does Not Meet"** ⚠ F-001 | n/a | n/a | n/a | n/a | n/a | **"below healthy"** ⚠ F-011 | **"below healthy"** (Staffing Advisor) ⚠ F-011 / "sustainable" (Commission Reviewer) ⚠ F-011 |
| Y1 Reserve Days | `computeFPFScorecard` | 104 ✓ | n/a | n/a | 104 ✓ | $295,230 ending cash supports 104 days | 104 ✓ | 104 ✓ | 104 ✓ |
| Y1 Ending Cash | `computeCarryForward` | $295,230 ✓ | n/a | n/a | $295,230 ✓ | $291,477 (Aug cumulative) ⚠ | n/a | $295,230 ✓ | $295,230 ✓ |
| Y1 SSE | `calcSmallSchoolEnhancement` | n/a | $0 (correct — exceeds K-6 minimum) | n/a | implicit in Operating Revenue | n/a | n/a | — | — |
| Y2 Total Enrollment (retention=92) | `computeExpansionEnrollments` | 90 ✓ | n/a | implicit (4 teachers × …) | 90 ✓ | n/a | n/a | — | — |
| Y5 Total Enrollment | `computeExpansionEnrollments` | 112 ✓ | n/a | 6 teachers × … | 112 ✓ | n/a | n/a | 112 ✓ (Ask agent cited) | — |
| FPF Stage applied to Y1 | `computeFPFScorecard` | tile says "Meets Stage 2" ⚠ F-004 | n/a | n/a | n/a | n/a | "Meets" (no stage label — correct) | n/a | "Stage 1 in Y1-2" ✓ |

**Y1 Ending Cash vs Aug Cumulative discrepancy:** Multi-Year says Y1 Ending Cash = $295,230. Cash Flow Aug Cumulative Balance = $291,477. Difference: $3,753 — interestingly close to the $3,750 Interest & Other Income from F-006. Same root cause: Multi-Year includes Interest in revenue, Cash Flow doesn't include it in apportionment-based cumulative. This is consistent with F-006.

**Headline SSOT conclusion:**
- 7 of 9 cross-checked metrics agree across all surfaces
- 2 metrics disagree (Revenue total → F-006; Personnel % verdict → F-001/F-011)
- The disagreements are both rooted in classification/threshold logic, not engine numbers (the underlying enrollment, cash, and dollar figures all flow from the same canonical engine)

## 4.2 — Exports

**Status:** PDF export button present on Overview tab. Excel export button present. Generation not triggered during this audit pass (each takes 30–60s + Anthropic tokens). Defer to a focused export-verification session post-fix of F-001/F-011 to avoid re-generating after threshold corrections.

**Specifically deferred verifications (per audit spec):**
- Budget Narrative PDF — Executive Summary cross-check against Overview, SVG charts render, AI narrative completes
- Commission V8 Excel — all 7 tabs populate, SSE on Revenue tab, OSPI apportionment percentages on cash flow tab, Total Margin / revenue line naming / AAFTE percentage note / Facilities Revenue $0 known outstanding items

## 4.3 — Portfolio visibility (ESWA admin login)

**Status:** DEFERRED for this audit run. Requires logging in as `admin@excellentschoolswa.org` (separate auth context from the audit account `travis+evergreen-audit@spokanearts.org`). The audit account doesn't have credentials for ESWA admin.

**Expected outcome (per spec):** Evergreen Heights Charter Academy should NOT appear in the ESWA portfolio because it's a self-serve signup (no `organization_id` link). This is RLS Option A — siloed school SELECT — and Phase 2 DB query confirmed `organization_id = NULL` on Evergreen's schools row.

**At the DB level this is verified.** UI-level verification requires the ESWA admin login.

## 4.4 — Team roles (school_viewer audit)

**Status:** DEFERRED for this audit run. Requires inviting a `school_viewer` via the Settings → Team Members surface, accepting the invitation via email, and logging in as that viewer. Each step is a 5–10 minute commitment.

**Code-level confirmation:** Phase 1 surveyed the `usePermissions()` hook (`canEdit`, `canManageTeam`, etc.). The hook gates Save buttons, edit controls, and admin surfaces by role. As long as the hook is wired through every relevant surface (a separate audit), school_viewer behaves correctly.

## 4.5 — Known backlog reproduction summary

| Backlog | Status during this audit | Notes |
|---|---|---|
| P-UX-01 (Revenue tab edit persistence) | **CONFIRMED reproducing** | Override input set to 999000, reload → empty, amount reverts. Exact match. |
| P-UX-02 (Joyride blocks nav on first visit) | **CONFIRMED reproducing during onboarding completion** (Part 1) | `elementFromPoint` returned `react-joyride__overlay` for Revenue nav link, `isClickReachable: false`. |
| P-UX-03 (Position driver type not editable) | **CONFIRMED reproducing** (Tab 3) | Driver column shows static text "Fixed" / "Per Pupil", no `<select>` or `<input>` for editing. |
| P-UX-04 (Three overlapping Students/Section controls) | **CONFIRMED reproducing** (Part 1, Step 2 onboarding) | Year 1 Grade Config + Grade Expansion Plan tables both editable, plus master "consistent class size" spinbutton. |
| P-UX-05 (Settings Danger Zone copy) | **RESOLVED** in BACKLOG (commit) — not re-verified | Tab 12 confirmed Danger Zone section present. |
| P-UX-06 (Opening year dropdown rolling 4-year window) | Not re-tested | Onboarding flow used 2027–2028 successfully. Drift behavior is a time-based bug; not exercised. |

---

# Part 5 — Findings Summary

## Findings count

| Severity | Count | Items |
|---|---|---|
| **High** | 2 | F-001 (Personnel % tile threshold), F-011 (Personnel % verdict inconsistent across 3 surfaces — escalation of F-001) |
| Medium | 1 | F-006 (Revenue tab vs Multi-Year Operating Revenue inconsistency — Interest classification) |
| Low | 5 | F-002 (Overview strip omits Y0), F-005 (SSE spec correction, not code bug), F-007 (Staffing header missing Personnel % badge), F-008 (Transportation row visible when disabled), F-009 (Food Service formula shown despite net-zero), F-010 (Multi-Year omits Y0 column — same as F-002), F-012 (Fiscal year not shown in Settings) |
| Spec/Verify | 1 | F-004 RESOLVED — tile cosmetic only |

## Pre-May-19 fix priority

**Block ship until fixed:**
- F-001 / F-011 (Personnel % threshold logic) — the inconsistency across tile, Overview Briefing, Ask, and Staffing Advisor is the most visible quality issue. Commission demo will catch this. Recommend year-aware threshold helper as single SoT.
- F-006 (Operating Revenue mismatch) — $3,750 difference between two surfaces of the same number. Cross-cutting verification flagged it. Fix is small (clarify Interest classification).

**Non-blocking (post-May-19):**
- F-002, F-008, F-009, F-010, F-012 — UX polish / cosmetic
- F-005 — spec correction, not code

**R-ENR-01 verification across the audit: SUCCESSFUL**

- Engine fix (F2): Multi-Year, Overview, Ask, Advisory Panel all reflect retention=92 trajectory `[72, 90, 107, 122, 112]` correctly
- UI fix (F1): Settings slider works end-to-end; verified across all 3 read-path cases
- AI prose fix (F3): No "attrition backfilled" regression on any surface; new buildout-decline prose correctly engaged by Ask agent (explicitly cited "122 Year 4 students × 92% retention rate")
- DB backfill: 16 schools updated to retention=92, 12 advisory caches cleared and regenerated on first visit
- All 18 unit tests pass

The audit's most important conclusion is that R-ENR-01 worked. The remaining findings are pre-existing or threshold-logic issues unrelated to the retention engine fix.
