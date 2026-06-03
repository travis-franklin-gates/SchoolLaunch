# R-REV-05 Diagnosis: WA Charter default salary benchmarks

Status: investigation only (no code written). Repo-based analysis; LSP available
but grep + tsc used as primary per operator note. supabase MCP down, so the
existing-school count is skipped (forward-only recommended). playwright available
for a tooltip render check in Phase 2.

HEADLINE: the prompt assumed "one canonical location" of low defaults. There is
no single location - WA Charter salary defaults are SPREAD ACROSS FOUR sources
that disagree. The "25-40% below benchmark" problem is real but narrower than it
looks: it lives in the TWO seed paths a new applicant actually hits, and only for
the ~7 positions those paths instantiate. The 27-position benchmark catalog the
dashboard already uses is OSPI/BLS-aligned.

---

## D1 - Where defaults live (FOUR sources, with drift)

1. src/components/onboarding/StepStaffing.tsx, buildDefaultPositions() (lines 54-126)
   - HARDCODED low salaries for ~6 WA positions. THIS is the WA onboarding path.
   - Dispatch confirmed at StepStaffing.tsx:173-177: getDefaults() routes
     config.pathway === 'wa_charter' to buildDefaultPositions(); all other
     pathways route to buildDefaultPositionsFromConfig() (reads stateConfig).
   - Onboarding persists these via api/onboarding/complete/route.ts:183
     (annual_salary: p.salary). This is what a real applicant submits with.

2. src/app/api/staffing/seed/route.ts, SEED_POSITIONS (lines 7-14)
   - HARDCODED low salaries for the same 6 positions, PLUS a separate
     benchmarkSalary field that already equals the COMMISSION_POSITIONS value.
   - Called only as a fallback from the Staffing dashboard
     (staffing/page.tsx:338) when a school has zero positions.
   - Writes annual_salary = salary (low) and benchmark_salary = benchmarkSalary
     (the OSPI/BLS number) into staffing_positions.

3. src/lib/types.ts, COMMISSION_POSITIONS (27 positions, `salary` field)
   - The OSPI/BLS-aligned benchmark catalog (MID numbers, e.g. CEO 164800).
   - The Staffing DASHBOARD defaults a newly-added/changed position to this
     value (staffing/page.tsx:561-562: salary: cp.salary). So positions added
     after onboarding already start at benchmark.

4. src/lib/stateConfig.ts, WA_CHARTER_POSITIONS (27 positions, `default_salary`)
   - Comment at stateConfig.ts:97 claims "Exact match to COMMISSION_POSITIONS"
     and the numbers do match source 3. BUT this catalog is NOT used for WA
     onboarding (only buildDefaultPositionsFromConfig reads it, and WA never
     calls that). Effectively a DEAD parallel catalog for the WA pathway.

DRIFT (this is the P-UX-09/P-UX-10 theme, salary edition):
- Onboarding CEO = 120,000 ; dashboard-add CEO = 164,800 ; same school, same role.
- Sources 1 and 2 (the live seed paths) carry low numbers; sources 3 and 4 carry
  the OSPI/BLS benchmark. The two that a founder hits first (onboarding, seed)
  are the low ones.

Single-source-of-truth verdict: VIOLATED. Per the hard constraint, this is
reported, not silently patched on one side. Fix options in the checkpoint cover
lockstep-update vs consolidation.

---

## D2 / D3 - Full position table (current vs proposed, with source)

Legend: SEED = low salary in StepStaffing.buildDefaultPositions + SEED_POSITIONS
(only the ~7 instantiated at onboarding/seed carry a SEED value); CATALOG =
COMMISSION_POSITIONS.salary (the dashboard/benchmark default, source 3); V11 =
Commission template benchmark from the V11 reconciliation.

The under-market bug is the SEED column being below CATALOG. The 20 positions
with no SEED value already default to CATALOG when added on the dashboard.

| # | position_type | CATALOG (current benchmark) | SEED (onboarding/seed) | V11 | Proposed default | Source for proposed |
|---|---|---:|---:|---:|---:|---|
| 1 | ceo_director | 164,800 | 120,000 | 200,000 | 200,000 (DP2) or 164,800 | V11 template / else in-code OSPI-BLS |
| 2 | principal | 123,600 | 95,000 | 130,000 | 130,000 (DP2) or 123,600 | V11 template / else in-code OSPI-BLS |
| 3 | asst_principal | 97,850 | - | - | 97,850 | in-code OSPI-BLS catalog |
| 4 | registrar | 61,800 | - | - | 61,800 | in-code OSPI-BLS catalog |
| 5 | coo | 113,300 | - | - | 113,300 | in-code OSPI-BLS catalog |
| 6 | cfo | 113,300 | - | - | 113,300 | in-code OSPI-BLS catalog |
| 7 | it_coordinator | 82,400 | - | - | 82,400 | in-code OSPI-BLS catalog |
| 8 | facilities_mgr | 72,100 | - | - | 72,100 | in-code OSPI-BLS catalog |
| 9 | nutrition_mgr | 61,800 | - | - | 61,800 | in-code OSPI-BLS catalog |
| 10 | instructional_coach | 87,550 | - | - | 87,550 | in-code OSPI-BLS catalog |
| 11 | teacher_elem | 80,340 | 58,000 | - | 80,340 | in-code OSPI-BLS catalog |
| 12 | teacher_ms | 82,400 | 62,000 (secondary) | - | 82,400 | in-code OSPI-BLS catalog |
| 13 | teacher_hs | 84,460 | - | - | 84,460 | in-code OSPI-BLS catalog |
| 14 | sped_teacher | 87,550 | 62,000 | 85,000 | 87,550 (keep; exceeds V11) | in-code OSPI-BLS catalog |
| 15 | el_specialist | 82,400 | - | - | 82,400 | in-code OSPI-BLS catalog |
| 16 | interventionist | 80,340 | - | - | 80,340 | in-code OSPI-BLS catalog |
| 17 | paraeducator | 41,200 | 38,000 | 40,000 | 41,200 (keep; exceeds V11) | in-code OSPI-BLS catalog |
| 18 | substitute_pool | 30,900 | - | - | 30,900 | in-code OSPI-BLS catalog |
| 19 | counselor | 77,250 | - | - | 77,250 | in-code OSPI-BLS catalog |
| 20 | social_worker | 68,000 | - | - | 68,000 | in-code OSPI-BLS catalog |
| 21 | psychologist | 87,550 | - | - | 87,550 | in-code OSPI-BLS catalog |
| 22 | office_mgr (Admin Asst) | 56,650 | 52,000 | blank | 56,650 | in-code OSPI-BLS catalog |
| 23 | hr_specialist | 77,250 | - | - | 77,250 | in-code OSPI-BLS catalog |
| 24 | custodian | 43,260 | - | - | 43,260 | in-code OSPI-BLS catalog |
| 25 | security | 51,500 | - | - | 51,500 | in-code OSPI-BLS catalog |
| 26 | food_service | 30,900 | - | - | 30,900 | in-code OSPI-BLS catalog |
| 27 | transport_coord | 61,800 | - | - | 61,800 | in-code OSPI-BLS catalog |

Sourcing notes / flags:
- For SPED (#14) and paraeducator (#17), the in-code CATALOG is HIGHER than V11.
  Proposed keeps the higher OSPI/BLS figure - lowering to V11 would re-create an
  under-market default. Flagged so this is a conscious choice.
- "in-code OSPI-BLS catalog" = COMMISSION_POSITIONS + stateConfig
  benchmark_salaries_source = 'OSPI/BLS WA'. The per-position SOC code is NOT
  recorded in the codebase. I am NOT inventing SOC codes. If you want fresh
  S-275 / BLS SOC provenance per line, that is a separate sourcing pass (can be a
  backlog item); the existing catalog is the accepted source of record today.
- The only genuine V11-vs-catalog gaps are the two execs (CEO, principal) -
  decision DP2 below.

---

## D4 - Existing-school / fixture impact

- Changing code defaults is FORWARD-ONLY by construction: existing schools'
  staffing_positions rows carry their own annual_salary values; a default change
  does not rewrite stored rows.
- No test READS the catalog defaults. Salary numbers in tests are inline literals
  or DB reads:
  - tests/session4/revenue-classification.spec.ts:75-80 hardcodes the OLD low
    defaults (120000/95000/58000/62000/52000/38000) as inline fixture rows. These
    will NOT break (the test asserts revenue classification, not defaults) but
    become stale relative to shipped defaults. Flag, do not necessarily change.
  - tests/session4/advisory-hash.spec.ts:47 hardcodes annual_salary 120000 inline
    for hash-stability; unaffected.
  - advisory-cache-invalidation.spec.ts / scenario-staleness.spec.ts read salary
    from the DB and restore it; independent of defaults.
  - full-founder-journey.spec.ts:357 fills salary inputs relatively (n + bump).
- Cedar Grove: extract_sl.ts reads annual_salary from the DB row
  (Number(p.annual_salary)); the 120000 at extract_sl.ts:88 is an Operations
  "Curriculum & Materials" amount, NOT a salary. Cedar Grove carries explicit
  salaries in its DB rows -> unaffected.
- Spokane Arts: no salary pinned in repo (fixture is login only); DB rows carry
  explicit salaries -> unaffected. SSE baseline does not move.

Plain statement: no fixture or test pins a value that DEPENDS on the old default;
changing defaults breaks no test and moves no fixture.

---

## D5 - Tooltip surface

- Reuse src/components/ui/Tooltip.tsx (the S4-03 custom component). It wraps a
  single child element, supports `multiline`, and is already imported in both
  StepStaffing.tsx:8 and staffing/page.tsx:12. No new component needed.
- Salary inputs to annotate:
  - Onboarding: StepStaffing.tsx ~397 (NumberInput value={p.salary}).
  - Dashboard: staffing/page.tsx ~1131 (input value={pos.salary}).
- Copy (ASCII): "Default from BLS WA / OSPI S-275 - verify against your local
  market." Attach to a small info affordance next to the salary field/label so it
  does not interfere with the numeric input.

---

## Recommended fix (one paragraph)

Treat the OSPI/BLS benchmark catalog (COMMISSION_POSITIONS) as the single source
of truth and raise the two LOW seed paths up to it, rather than inventing new
numbers. Concretely: make StepStaffing.buildDefaultPositions and the seed route's
SEED_POSITIONS read each position's salary from getCommissionPosition(type).salary
(consolidation, DP3 option S2) so there is exactly one place to edit; or, if a
smaller change is preferred, update the hardcoded salaries in BOTH paths in
lockstep to the CATALOG values (DP3 option S1) and log consolidation as backlog.
For the two execs where V11 exceeds the in-code catalog, adopt V11 (CEO 200,000;
Principal 130,000) to match the template WSCSC reviews against (DP2); keep SPED
and paraeducator at the higher in-code OSPI/BLS figure. Forward-only, no migration
(DP4). Add the source tooltip to both salary inputs. Do not touch Generic /
Private / Micro pathways (they route through buildDefaultPositionsFromConfig and
their own configs) and do not build regionalization.
