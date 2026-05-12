# Part 2 — Baseline Snapshot

**Date:** 2026-05-11
**School:** Evergreen Heights Charter Academy
**School ID:** `7d82e5d1-7943-4103-9144-a4e175da9282`
**User ID:** `062f5688-c1d8-4ad3-b1b1-f8c5ba108b90`
**Email:** travis+evergreen-audit@spokanearts.org

---

## `schools` row

| Field | Value |
|---|---|
| name | Evergreen Heights Charter Academy |
| organization_id | NULL (self-serve signup, no portfolio link) |
| pathway | `wa_charter` |
| state | `WA` |
| school_type | `charter` |
| status | `planning` |
| created_at | 2026-05-11 16:04:55 UTC |

## `school_profiles` core fields

| Field | Value |
|---|---|
| region | `yakima_county` |
| planned_open_year | 2027 |
| fiscal_year_start_month | 9 (September) |
| opening_grades | `[K, 1, 2]` |
| buildout_grades | `[K, 1, 2, 3, 4, 5]` |
| target_enrollment_y1..y5 | 72, 96, 120, 144, 144 |
| max_class_size | 24 |
| retention_rate | 100 (no UI control in onboarding) |
| pct_frl / pct_iep / pct_ell / pct_hicap | 45 / 12 / 8 / 5 |
| per_pupil_rate (column) | 15000 ⚠️ see Finding A |
| lease_sqft / lease_rate_per_sqft / lease_monthly_flat | NULL / NULL / NULL (estimate-for-me ON) |
| tuition_rate / financial_aid_pct | NULL / NULL (charter) |
| onboarding_complete | true |

## `school_profiles.financial_assumptions` (JSONB)

```json
{
  "aafte_pct": 95,
  "per_pupil_rate": 12000,
  "sped_per_pupil": 4500,
  "contingency_pct": 2,
  "insurance_annual": 18000,
  "revenue_cola_pct": 3,
  "benefits_load_pct": 30,
  "ops_escalator_pct": 2,
  "authorizer_fee_pct": 3,
  "facilities_per_pupil": 0,
  "food_service_offered": true,
  "regular_ed_per_pupil": 12000,
  "salary_escalator_pct": 2.5,
  "supplies_per_student": 200,
  "interest_rate_on_cash": 3,
  "regionalization_factor": 1,
  "technology_per_student": 180,
  "transportation_offered": false,
  "levy_equity_per_student": 0,
  "food_service_per_student": 1200,
  "transportation_per_student": 800,
  "food_service_revenue_per_pupil": 710,
  "contracted_services_per_student": 150,
  "transportation_revenue_per_pupil": 560
}
```

## `school_profiles.startup_funding` (JSONB)

```json
[
  {
    "type": "grant",
    "amount": 250000,
    "source": "Federal CSP Grant",
    "status": "projected",
    "selectedYears": [0, 1, 2, 3, 4],
    "yearAllocations": { "0": 250000, "1": 0, "2": 0, "3": 0, "4": 0 }
  }
]
```

## `school_profiles.pre_opening_expenses` (JSONB)

`[]` (empty)

## `user_roles`

| Field | Value |
|---|---|
| role | `school_ceo` |
| display_name | Evergreen Test CEO |
| tour_completed | false (tour was Skipped, not Completed) |

## Row counts

| Table | Count |
|---|---|
| staffing_positions | 6 |
| budget_projections | 25 |
| grade_expansion_plan | 24 |

---

## 10 Baseline Assertions

| # | Assertion | Source | Status |
|---|---|---|---|
| 1 | Pathway = `wa_charter` | `schools.pathway` | ✅ |
| 2 | Fiscal year start month = 9 | `school_profiles.fiscal_year_start_month` | ✅ |
| 3 | Authorizer fee = 3% | `financial_assumptions.authorizer_fee_pct` | ✅ value; "locked" needs UI verify |
| 4 | Levy equity = $0/student | `financial_assumptions.levy_equity_per_student` | ✅ |
| 5 | SSE non-zero | runtime via `calcCommissionRevenue` | DEFERRED — needs Revenue tab read (school is 68.4 AAFTE, above K-6 band's 60 minimum, so should fire) |
| 6 | LAP base fires | onboarding live preview ($26,438) | ✅ |
| 7 | LAP HP does NOT fire | onboarding live preview ($0) | ✅ |
| 8 | Title I fires | onboarding live preview ($28,512) | ✅ |
| 9 | FPF Stage 1 (Y1–2) / Stage 2 (Y3+) | runtime via `computeFPFScorecard` | DEFERRED — needs Commission Scorecard tab |
| 10 | $250K Year 0 → Year 1 carry-forward | `startup_funding.yearAllocations["0"] = 250000` | ✅ at DB level; runtime carry-forward via `computeCarryForward` needs Cash Flow tab |

**7 of 10 confirmed at DB level. 3 deferred to first-pass tab reads (Revenue, Commission Scorecard, Cash Flow).**

---

## Findings From Part 1 + Part 2

### Confirmed reproductions of known backlog
- **P-UX-02 Joyride tour blocks navigation on first dashboard visit.** Hard-reproduced via `document.elementFromPoint` returning `react-joyride__overlay` for the Revenue nav link's center coordinates instead of the link itself. `isClickReachable: false`.
- **P-UX-04 Three overlapping Students/Section controls on enrollment editor.** Year 1 Grade Config table has individual per-grade spinbuttons, the Grade Expansion Plan table below repeats them, and there's a "consistent class size" master spinbutton at top. All three editable, can drift out of sync.

### New observations (candidates for findings)

**A — Dual `per_pupil_rate` sources of truth in `school_profiles`.**
- `school_profiles.per_pupil_rate` (top-level column) = `15000`
- `financial_assumptions.per_pupil_rate` (JSONB) = `12000`
- `financial_assumptions.regular_ed_per_pupil` (JSONB) = `12000`

If both are read at different code paths this is a correctness risk. Likely one is legacy and unused — but worth confirming which is canonical. Grep target: `per_pupil_rate` across `src/lib`.

**B — Onboarding defaults for per-pupil ops costs are LOWER than spec values, except insurance which is HIGHER.**

| Field | Spec | Actual default |
|---|---|---|
| supplies_per_student | $500 | $200 |
| technology_per_student | $300 | $180 |
| contracted_services_per_student | $400 | $150 |
| insurance_annual | $15,000 | $18,000 |

Not necessarily a bug — these aren't user-entered in the onboarding flow. But the spec assumed the defaults were the spec values. Worth confirming which set is intentional. May affect Operations tab audit expectations.

**C — Personnel % = 68.6% is below the spec's "healthy band" of 72–78%.**
On the Staffing onboarding step the helper text reads "Below typical — room for additional hires." Either:
- The default 6-position template is under-staffed for K-2 / 72 students, OR
- The 72–78% target band in the spec is wrong for founding-year small schools

Worth deciding which interpretation is correct before flagging as a "finding."

**D — `staffing_positions` count = 6, not 27.**
CLAUDE.md describes "27 Commission-aligned position template." Actual default is a 6-position starter set; the 27 is presumably the catalog accessible via "+ Add Position." Spec language is ambiguous — should the default template include all 27 with zero FTE, or just 6 with non-zero FTE? Cosmetic but worth clarifying for the audit's "27 OSPI-aligned position rows" expectation on the Staffing tab.

**E — `startup_funding.selectedYears` default-includes ALL years even when only Year 0 is allocated.**
The selectedYears array is `[0,1,2,3,4]` but only Year 0 has a non-zero allocation. This is a data-hygiene oddity — the `yearAllocations` is the source of truth, so the redundant `selectedYears` doesn't cause incorrect output, but it's confusing if anyone reads the JSON later. Low severity.

**F — `retention_rate = 100` auto-set without a UI control during onboarding.**
The spec mentions retention in Step 2 ("Expansion algorithm | Default"). There's no retention input in the onboarding flow. It's hard-coded to 100% in the schema default. May or may not be exposed on the Settings tab — to be verified.

**G — Email confirmation is NOT required by Supabase for signup.**
Account was created and routed to onboarding immediately without any email verification step. This may be intentional for dev/staging but worth confirming for production. Not necessarily a finding for this audit but flagging.

**H — Password "excellent" (per spec) fails validation.**
Validation requires 8+ chars AND a number/symbol. Used "excellent1" for this audit. Either the spec needs updating or the validation rule should be relaxed.
