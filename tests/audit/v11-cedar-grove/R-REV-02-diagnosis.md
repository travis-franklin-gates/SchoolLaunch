# R-REV-02 Diagnosis: LAP High Poverty new-applicant gating

Status: investigation only (no code written). Repo-based fallbacks used
(Grep for find-references, migrations + types.ts for schema) because the
typescript-lsp and supabase MCP servers were down at pre-flight. Per the
operator directive, supabase/migrations/*.sql is treated as authoritative
over types.ts on any disagreement.

---

## D1 - Computation site

CANONICAL site (the fix goes here):
- src/lib/calculations.ts:149, inside calcCommissionRevenue:
    const lapHighPoverty = pctFrl >= 50 ? Math.round(headcount * (pctFrl / 100) * lapHighPovertyRate) : 0
  This is distinct from the LAP BASE line one line above (calculations.ts:146,
  variable `lap`, rate `lapRate`). The base line is OUT OF SCOPE and untouched.

Every caller of calcCommissionRevenue (so every site that consumes LAP HP)
flows through this one function:
- src/lib/budgetEngine.ts:157, 253, 545 (computeMultiYearDetailed year loop;
  rev.lapHighPoverty -> row.revenue.lapHighPoverty at budgetEngine.ts:686)
- src/lib/buildSchoolContext.ts:172, 317 (AI context prose)
- src/lib/ScenarioContext.tsx:112, 117
- src/lib/calculations.ts:316 (internal helper)
- src/app/(onboarding)/onboarding/page.tsx:533
- src/app/api/onboarding/complete/route.ts:75, 133 (persists Y1 LAP HP row)
- src/components/onboarding/Step{Demographics,Enrollment,Operations,Staffing}.tsx
- src/app/(authenticated)/dashboard/revenue/page.tsx:128, 129
- src/app/(admin)/portfolio/[schoolId]/page.tsx:134
- Exports (commission Excel, narrative PDF) read multiYear rows, which already
  derive from calcCommissionRevenue. No recomputation.

Export-surface check (operator directive): calculations.ts has exactly one
re-export statement (calculations.ts:320: PER_PUPIL_RATE, LEVY_EQUITY_RATE,
BENEFITS_RATE, AUTHORIZER_FEE_RATE). No aliased/renamed re-exports of any calc
function, so the grep find-references above is complete.

PARALLEL computations found (must be acknowledged):
1. src/lib/calculations.ts:82, calcAllGrants - a DUPLICATE gate
   (pctFrl >= 50 ? ... : 0). calcAllGrants is DEAD: referenced only by its own
   definition and an unused import at budgetEngine.ts:4; never invoked in any
   active path. It does NOT feed projections. Recommend leaving it untouched
   for this fix (out of scope) but flagging for later removal.
2. src/app/(authenticated)/dashboard/settings/page.tsx:113 - a settings GRANT
   PREVIEW: Math.round(enrollY1 * rate). This is already inconsistent with the
   canonical line TODAY (no 50% gate, no pctFrl/100 scaling) - it is a flat
   rate-illustration widget, not the projection. Out of scope; flagged.

Conclusion: single canonical site confirmed at calculations.ts:149. No active
page recomputes the projection LAP HP independently.

---

## D2 - Applicant-status representation

No applicant-status signal exists in the schema. Grep of all
supabase/migrations/*.sql for opening_year / years_in_operation / has_frpl /
frpl_history / applicant returned NO matches. The only related column is
SchoolProfile.planned_open_year (types.ts:128), which is a target open year,
not a years-in-operation or FRPL-history signal.

calcCommissionRevenue has NO pathway parameter. It takes only scalar
demographics + assumptions + colaYear + sse. Pathway isolation is structural,
not parameterized:
- LAP High Poverty is a WA-Charter-ONLY revenue line. It appears in
  WA_CHARTER_REVENUE_LINES (stateConfig.ts:218) and is ABSENT from
  GENERIC_CHARTER_REVENUE_LINES, PRIVATE_SCHOOL_REVENUE_LINES, and
  MICRO_SCHOOL_REVENUE_LINES. The Generic pathway uses a different revenue model
  (per_pupil_funding, ell_funding, etc.) and has no LAP HP concept at all.
- Therefore gating LAP HP cannot affect Generic-pathway behavior: that pathway
  never surfaces this line.

Plain statement: the WA Charter pathway in this product is a PRE-OPENING
PLANNING TOOL. Every school modeled in it is a new applicant by definition;
none has accrued a 3-year rolling FRPL history. There is no existing-school
conversion or replication-applicant flag anywhere in the schema.

This points to Option A (gate by definition, no schema change). Option B (add a
has_frpl_history column) is only justified if existing-school-conversion
applicants are expected; the schema shows no such use case today.

---

## D3 - Per-year feasibility

computeMultiYearDetailed indexes years with a clean loop:
  for (let y = 1; y <= 5; y++)   (budgetEngine.ts:536)
and calls calcCommissionRevenue(enr, ..., assumptions, y, smallSchoolEnhancement)
at budgetEngine.ts:545, passing `y` as the colaYear. rev.lapHighPoverty is
written per-year into row.revenue.lapHighPoverty at budgetEngine.ts:686.

A per-year gate is therefore cleanly implementable. An Option (ii) Y4 ramp
(HP = 0 in Y1-Y3, populated Y4-Y5) is feasible by threading a per-year boolean
(e.g. hasFrplHistory = y >= 4) into calcCommissionRevenue from this loop. No
structural change to the loop is needed.

---

## D4 - Existing regression coverage (tests/session4/revenue-integrity.spec.ts)

Assertions that PIN LAP HP and WILL CHANGE under the fix:
- Test "LAP High Poverty: 50% FRPL threshold gate + pctFrl factor"
  (lines 20-39). Sub-threshold cases (pctFrl=0 line 23, pctFrl=49 line 27)
  still assert 0 and still hold. But the AT-threshold case (pctFrl=50,
  lines 30-32, expects round(300*0.5*374)=56100) and the ABOVE-threshold case
  (pctFrl=80, lines 35-38, expects round(300*0.8*374)=89760) assert POSITIVE
  values for a default (new-applicant) call. Under the fix these become 0, so
  these two assertions BREAK and must be rewritten to reflect new-applicant
  gating (and, if Option B / a history flag, re-expressed by passing the flag).

Invariants that MUST continue to hold and DO (LAP HP nets out on both sides):
- SSE inclusion in rev.total (lines 41-59): uses pctFrl=30, LAP HP already 0
  before and after. Unchanged.
- Step 2 / Step 3 cross-consistency (lines 61-89): uses pctFrl=60. LAP HP drops
  from 56100 to 0 but appears on BOTH rev.total and step3GrantLines, so the
  equality holds; totalGrants stays > 0 via other grants. Unchanged.
- Constituent-sum invariant (lines 91-132): LAP HP appears on both sides of the
  rev.total = sum-of-lines equality, so all cases still pass. Unchanged.

Net: only the dedicated threshold test's two positive assertions change; the
three structural invariants survive untouched.

---

## D5 - Blast radius

Cedar Grove (240 students, 60% FRL, new applicant), colaYear=1, rate 374:
- CURRENT Y1 LAP HP = round(240 * 0.60 * 374) = 53,856  (matches V11 gap report)
- UNDER FIX Y1 LAP HP = 0  (matches V11 expected 0)
- Y2-Y5 currently grow with enrollment + COLA to roughly 197K by Y5 (per the
  V11 gap log). Under Option A(i) all five years become 0; under Option (ii)
  Y1-Y3 = 0 and Y4-Y5 populate once self-accrued history exists.

Spokane Arts (SSE regression baseline, travis@spokanearts.org): its
demographics are NOT in the repo (the fixture is only a login credential), and
per the no-DB-access rule I did not query it. Conditional statement:
- If Spokane Arts FRL >= 50%, its LAP HP line drops to 0 under Option A (it is
  also a new applicant in this pre-opening tool). This would be an EXPECTED
  consequence of the fix, not a regression.
- If Spokane Arts FRL < 50%, its LAP HP is already 0; no change.
- Either way, the SSE-specific regression assertions in revenue-integrity.spec.ts
  use pctFrl=30, so the SSE baseline value those tests pin does NOT shift.

---

## Recommended fix (one paragraph)

Gate the LAP High Poverty SUPPLEMENT inside calcCommissionRevenue
(calculations.ts:149) so it is suppressed for new applicants, leaving the LAP
base line, rev.total semantics, and the Generic pathway untouched. Because no
schema signal for FRPL history exists and the WA Charter pathway is a
pre-opening planning tool (new-applicant-by-definition), Option A is correct -
no migration. Implement via an optional parameter (default = no history) rather
than a hard zero, so the logic is explicit, documents the OSPI 3-year rolling
FRPL rule (RCW 28A.165) inline, and stays forward-compatible with a future Y4
ramp. Recommended horizon behavior: (i) HP = 0 across Y1-Y5 to match the V11 /
Commission template for July 1 WSCSC submission credibility. Then update the two
positive assertions in the threshold test and add explicit Cedar Grove coverage.
