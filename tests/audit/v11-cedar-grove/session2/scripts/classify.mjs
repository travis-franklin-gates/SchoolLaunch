// Phase 3 — classify deltas per (line × year) into the 4-category rubric.
import fs from 'node:fs';
import path from 'node:path';

const v11 = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/v11_values.json', 'utf8'));
const sl = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/sl_values.json', 'utf8'));

const years = ['y1', 'y2', 'y3', 'y4', 'y5'];
const slYears = sl.multiyear_detailed; // index 0..4

// SL revenue per year, normalized to V11-comparable lookups
const slRev = (y, key) => slYears[y - 1].revenue[key] ?? 0;
const slOps = (y, key) => slYears[y - 1].operations[key] ?? 0;
const slPersTotal = (y) => slYears[y - 1].personnel.total ?? 0;
const slPersSalaries = (y) => slYears[y - 1].personnel.totalSalaries ?? 0;
const slPersBenefits = (y) => slYears[y - 1].personnel.benefits ?? 0;
const slTotalRev = (y) => slYears[y - 1].revenue.total ?? 0;
const slTotalExp = (y) => slYears[y - 1].totalExpenses ?? 0;
const slNet = (y) => slYears[y - 1].net ?? 0;
const slCumNet = (y) => slYears[y - 1].cumulativeNet ?? 0;
const slDCOH = (y) => slYears[y - 1].reserveDays ?? 0;

const v11Val = (groupPath, key, y) => {
  // groupPath like 'revenue' or 'expenses_detail'
  const node = v11.values[groupPath]?.[key];
  return node?.[y]?.value ?? null;
};

const classifications = [];

const fmtPct = (delta, denom) => {
  if (denom === 0 || denom == null) return null;
  return Math.round((delta / Math.abs(denom)) * 1000) / 10;
};

const addLine = (line, year, v11v, slv, classObj) => {
  const v = v11v ?? 0;
  const s = slv ?? 0;
  const delta = s - v;
  const pct = fmtPct(delta, v);
  classifications.push({
    line,
    year,
    v11_value: v,
    sl_value: s,
    delta_dollars: Math.round(delta),
    delta_pct: pct,
    ...classObj,
  });
};

// Helper: define a line by V11-key, SL-getter, and classification logic per year
const reconcile = (label, v11Group, v11Key, slGetter, classFn) => {
  for (let y = 1; y <= 5; y++) {
    const v = v11Val(v11Group, v11Key, `y${y}`);
    const s = slGetter(y);
    const c = classFn(y, v, s);
    addLine(label, y, v, s, c);
  }
};

// ============================================================
// REVENUE
// ============================================================

reconcile('Revenue · BEA (3100 / Regular Ed)', 'revenue', 'bea_3100',
  (y) => slRev(y, 'regularEd'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'SL: AAFTE × $12,613 × 1.030 regionalization × COLA. V11: same rate but applies regionalization differently or uses already-regionalized OSPI table. Same base rate input — gap is regionalization multiplier or OSPI rate-table version. § BEA regionalization still unresolved per V11 analysis §9.7.',
    backlog_ref: 'Spec doc update (regionalization clarity)',
  }));

reconcile('Revenue · SPED General Apportionment (3121)', 'revenue', 'sped_general_3121',
  (y) => slRev(y, 'sped'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'Both use $455 per SPED student. V11: AAFTE × 16% IEP × $455. SL: same. Slight delta is regionalization placement.',
    backlog_ref: 'Spec doc',
  }));

reconcile('Revenue · State SPED (4121)', 'revenue', 'sped_state_4121',
  (y) => slRev(y, 'stateSped'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'Both use $14,631 per SPED student. Slight delta is regionalization placement / rounding.',
    backlog_ref: 'Spec doc',
  }));

reconcile('Revenue · LAP (4155)', 'revenue', 'lap_4155',
  (y) => slRev(y, 'lap'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'SL: N × FRL% × $816 (matches RCW 28A.165 prototypical-school formula). V11: N × flat $370/total-pupil (presentation simplification). SL is statute-correct per V11 analysis §9.3.',
    backlog_ref: 'Spec doc; SL matches statute',
  }));

// LAP High Poverty — V11 has no separate line; treat V11 value as $0
// ADJUDICATED 2026-05-23 → Platform bug (A), mapped to R-REV-02.
// Formula itself is statute-correct in steady-state, but the missing
// 3-year-FRPL-history gate is the bug. Applies to every new-applicant fixture,
// not just Cedar Grove → flag prominently in Recommendations.
for (let y = 1; y <= 5; y++) {
  const slv = slRev(y, 'lapHighPoverty');
  classifications.push({
    line: 'Revenue · LAP High Poverty (SL-only)',
    year: y,
    v11_value: 0,
    sl_value: slv,
    delta_dollars: Math.round(slv),
    delta_pct: null,
    classification: 'Platform bug',
    sub_category: 'A',
    rationale: 'OSPI confirms LAP High Poverty is a separate allocation gated on 3-year rolling FRPL ≥ 50%. Cedar Grove qualifies in steady-state (60% FRL) but has no 3-year history as a new applicant. SL\'s formula (N × FRL% × $374) is statute-correct; the bug is the missing history-availability gate. SL currently surfaces $54K-$197K/yr to every new-applicant fixture that exceeds 50% FRL. R-REV-02 is the open investigation.',
    backlog_ref: 'R-REV-02',
    impact_note: 'Universal to new-applicant fixtures — not Cedar Grove-specific.',
  });
}

reconcile('Revenue · TBIP (4165)', 'revenue', 'tbip_4165',
  (y) => slRev(y, 'tbip'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'SL: N × ELL% × $1,600 (statute-correct per-EL-student formula). V11: N × flat $185/total-pupil. Per V11 analysis §9.4 SL is closer to OSPI statute.',
    backlog_ref: 'Spec doc',
  }));

reconcile('Revenue · HiCap (4174)', 'revenue', 'hicap_4174',
  (y) => slRev(y, 'hicap'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'SL: N × HiCap% × $730 (per identified HiCap student). V11: N × flat $32/total-pupil. SL is statute-correct (V11 analysis §9.4). Cedar Grove pct_hicap=0 in SL so SL value is $0; V11 puts a positive value because its formula treats all students as if eligible. Configuration delta, not platform bug.',
    backlog_ref: 'Spec doc',
  }));

reconcile('Revenue · Title I', 'revenue', 'title_i',
  (y) => slRev(y, 'titleI'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'Federal Title I scales with low-income population. V11: N × flat $297/total-pupil. SL: N × FRL% × $880. Per V11 analysis §9.5 neither is exactly OSPI/Census formula but SL\'s × FRL% is the better simplification.',
    backlog_ref: 'Spec doc',
  }));

reconcile('Revenue · Title II', 'revenue', 'title_ii',
  () => 0,
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has Title II at $36/pupil. SL has no Title II line type. Confirmed missing — R-REV-03.',
    backlog_ref: 'R-REV-03',
  }));

reconcile('Revenue · Title III', 'revenue', 'title_iii',
  () => 0,
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has Title III at $23/pupil. SL has no Title III line type. Confirmed missing — R-REV-03.',
    backlog_ref: 'R-REV-03',
  }));

reconcile('Revenue · IDEA', 'revenue', 'idea',
  (y) => slRev(y, 'idea'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'V11: direct dollar entry (Cedar Grove $0 Y1, $132,921 Y2+). SL: N × IEP% × $1,500. Different model. SL\'s formula approximates federal IDEA grant scaling; V11 lets the modeler enter a known award. Both defensible. Note: SL gives Y1 a positive value where V11 has $0 because Cedar Grove did not bill IDEA in Y1.',
    backlog_ref: 'Spec doc; possible enhancement to allow direct-dollar override',
  }));

// CSP — ADJUDICATED 2026-05-23: split into THREE separate classification entries per year.
// (a) Data not entered (D3) — the $400K × 4 years is blocked by P-UX-11 like philanthropy.
// (b) Semantic question — recurring vs one-time — Needs decision pending WSCSC interpretation.
// (c) Platform shape — startup_funding recurring support — B (Missing line type), R-REV-04.
for (let y = 1; y <= 5; y++) {
  const v11Csp = v11Val('revenue', 'csp', `y${y}`) ?? 0;
  // Entry (a): D3 — known data not entered
  classifications.push({
    line: 'Revenue · CSP (a) — fixture data not entered',
    year: y,
    v11_value: v11Csp,
    sl_value: 0,
    delta_dollars: Math.round(-v11Csp),
    delta_pct: v11Csp > 0 ? -100 : null,
    classification: 'Not-bug (D3 — known data not entered)',
    sub_category: 'D3',
    rationale: 'V11 enters CSP at $400K Y2-Y5. SL fixture has nothing entered in startup_funding (blocked by P-UX-11 dashboard crash on direct JSON seeding). Same treatment as philanthropy: re-enter once P-UX-11 is fixed via the Revenue page UI.',
    backlog_ref: 'P-UX-11 (blocking data entry)',
  });
  // Entry (b): Needs decision — semantic question
  classifications.push({
    line: 'Revenue · CSP (b) — recurring vs one-time semantic',
    year: y,
    v11_value: v11Csp,
    sl_value: 0,
    delta_dollars: null,
    delta_pct: null,
    classification: 'Needs decision',
    rationale: 'V11 treats CSP as recurring operating revenue (counts toward FPF Total Margin, DCOH, 3-Year sustainability). SL today treats CSP as one-time startup_funding (excluded from FPF sustainability metrics). The right answer depends on what WSCSC actually expects in charter financial plans — pending external interpretation. Not forcing a category until WSCSC has weighed in.',
    backlog_ref: 'Open question for WSCSC; flag in Recommendations',
    no_dollar_classification: true,
  });
  // Entry (c): Platform shape gap — B (Missing line type)
  classifications.push({
    line: 'Revenue · CSP (c) — platform support for recurring startup grants',
    year: y,
    v11_value: v11Csp,
    sl_value: 0,
    delta_dollars: null,
    delta_pct: null,
    classification: 'Missing line type',
    sub_category: 'B',
    rationale: 'Even if WSCSC says CSP belongs in recurring operating revenue, SL\'s startup_funding JSONB doesn\'t carry a "recurring" semantic — its year_allocations are one-time disbursements excluded from sustainability metrics. Adding CSP as a recurring revenue line (or extending startup_funding semantics) is platform work tracked by R-REV-04. Dependent on (b).',
    backlog_ref: 'R-REV-04 (depends on WSCSC interpretation)',
    depends_on: 'Revenue · CSP (b) — recurring vs one-time semantic',
  });
}
// (Skip the old reconcile() call by passing a no-op)
const _csp_noop = (y, v, s) => null;

reconcile('Revenue · 6100 OSPI Special Purpose', 'revenue', 'ospi_special_purpose_6100',
  () => 0,
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has 6100 OSPI Special Purpose at $17K/yr (Y2+). SL has no equivalent. Confirmed missing — R-REV-03.',
    backlog_ref: 'R-REV-03',
  }));

reconcile('Revenue · 4198 State Food Service', 'revenue', 'food_service_state_4198',
  () => 0,
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has 4198 State Food Service at $23/pupil. SL has only one combined "Food Service (NSLP)" line that conflates federal 6198 + state 4198. State portion not separately represented — R-REV-03.',
    backlog_ref: 'R-REV-03',
  }));

reconcile('Revenue · 6198 Federal Food Service (NSLP)', 'revenue', 'food_service_federal_6198',
  (y) => slRev(y, 'foodServiceRev'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'V11: N × $795 federal NSLP rate. SL: N × $710 (general WA NSLP estimate). Both per-pupil rate-table values for the same federal program. $85/pupil rate-table difference yields ~$20K Y1, scales to ~$66K Y5.',
    backlog_ref: 'Spec doc / update SL rate-table default toward OSPI-published $795',
  }));

reconcile('Revenue · 4199 Transportation Operations', 'revenue', 'transportation_4199',
  (y) => slRev(y, 'transportationRev'),
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has 4199 Transportation as a state revenue line at $595/pupil. SL models transportation only as an expense toggle; the matching revenue line does not exist. Confirmed missing — R-REV-03. Cedar Grove Y1 V11 value: $146K; Y5 $525K.',
    backlog_ref: 'R-REV-03',
  }));

reconcile('Revenue · 2200 Sale of Goods/Services', 'revenue', 'sale_of_goods_2200',
  () => 0,
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has 2200 Sale of Goods at ~$6K/yr (Cedar Grove). SL has no equivalent line. Confirmed missing — R-REV-03 (low priority, small amount).',
    backlog_ref: 'R-REV-03',
  }));

reconcile('Revenue · 2300 Investment Earnings', 'revenue', 'investment_earnings_2300',
  (y) => slRev(y, 'interestIncome'),
  (y, v, s) => ({
    classification: 'Not-bug (V11 modeler choice)',
    sub_category: 'D2',
    rationale: 'V11 enters 2300 Investment Earnings as $0 (Cedar Grove modeler left blank). SL automatically computes interest income on prior cash at 3% (default). Both defensible; V11 chose direct-entry zero, SL uses formula default.',
    backlog_ref: 'Spec doc',
  }));

reconcile('Revenue · 8200 Private Foundations (Philanthropy)', 'revenue', 'private_foundations_8200',
  (y) => slRev(y, 'grantRevenue'),
  (y, v, s) => ({
    classification: 'Not-bug (D3 — known data not entered)',
    sub_category: 'D3',
    rationale: 'V11 has $250K Y1 + $300K/yr Y2-Y5 philanthropy as Local/Mixed 8200. SL fixture does not have this entered: blocked by P-UX-11 dashboard crash on direct startup_funding seeding. Per Session 1 §14.D the decision was to log this as a known offset rather than fix P-UX-11 first.',
    backlog_ref: 'P-UX-11',
  }));

// ============================================================
// EXPENSES
// ============================================================

// Personnel — V11 Total Personnel (services + benefits)
reconcile('Expenses · Personnel total (incl benefits)', 'expenses_totals', 'total_personnel_services_costs',
  (y) => slPersTotal(y),
  (y, v, s) => {
    // Add taxes & benefits since V11 separates them
    const v11Benefits = v11Val('expenses_totals', 'total_taxes_benefits', `y${y}`) ?? 0;
    return {
      classification: 'Not-bug (close match)',
      sub_category: 'D3-ish',
      rationale: 'Personnel costs match within ~5%: V11 = Services + Taxes&Benefits. SL = positions × salary × 1.30 benefits. Slight delta from rounding + small base-salary scaling differences. Salaries entered to match V11 directly (Session 1).',
      backlog_ref: 'R-REV-05 (defaults; not relevant to this fixture since salaries were overridden)',
      v11_personnel_only: v11Val('expenses_totals', 'total_personnel_services_costs', `y${y}`),
      v11_benefits_only: v11Benefits,
      v11_total_personnel: (v11Val('expenses_totals', 'total_personnel_services_costs', `y${y}`) ?? 0) + v11Benefits,
    };
  });

// Contracted Services
const v11ContractedY = (y) => {
  // Sum V11 contracted services lines for the year
  const lines = ['accounting_audit', 'legal', 'authorizer_fee', 'management_company_fee', 'payroll_services', 'nurse_services', 'special_ed_services', 'titlement_services', 'all_other_contracted'];
  return lines.reduce((s, k) => s + (v11Val('expenses_detail', k, `y${y}`) ?? 0), 0);
};
const slContractedY = (y) => slOps(y, 'contracted') + slOps(y, 'authorizerFee');
reconcile('Expenses · Contracted Services (V11 group total)', 'expenses_totals' /* unused */, 'total_personnel_services_costs' /* unused */,
  () => 0, // dummy
  (y, v, s) => {
    const v11Tot = v11ContractedY(y);
    const slTot = slContractedY(y);
    return {
      // Per Travis's annotation: this is a mix of fixture-fidelity and platform-modeling
      classification: 'Split: D2 (fixture) + B (platform)',
      sub_category: 'D2 + B',
      rationale: 'V11 Contracted Services bundles 9 sub-lines (Accounting/Audit, Legal, Oversight Fee, Mgmt Co Fee, Payroll, Nurse Services, SPED Services, Titlement Services, All Other). SL has only "Contracted Services" (flat $/student) + "Authorizer Fee" computed line — no separate sub-lines. Two distinct gaps: (1) fixture used SL default $150/student × 240 = $36K; if Cedar Grove\'s ~$528K Y1 V11 total were entered as an override, SL\'s structure could carry the dollar amount (D2 fixture-fidelity, re-enter); (2) Cedar Grove\'s sub-line detail (e.g., Nurse Services $43K Y1, SPED Services $264K Y1) cannot be itemized in SL — requires new BACKLOG entry for line-type expansion (B platform-modeling).',
      backlog_ref: 'D2 part: re-enter in fixture. B part: NEW candidate — expense-line itemization (Nurse Services, SPED Services, Titlement, Mgmt Co Fee, etc.)',
      v11_value_override: v11Tot,
      sl_value_override: slTot,
      delta_dollars_override: Math.round(slTot - v11Tot),
    };
  });

// Update the latest classification with the correct values
{
  for (let y = 1; y <= 5; y++) {
    const c = classifications.find((x) => x.line === 'Expenses · Contracted Services (V11 group total)' && x.year === y);
    if (c) {
      c.v11_value = c.v11_value_override;
      c.sl_value = c.sl_value_override;
      c.delta_dollars = c.delta_dollars_override;
      c.delta_pct = fmtPct(c.delta_dollars, c.v11_value);
      delete c.v11_value_override;
      delete c.sl_value_override;
      delete c.delta_dollars_override;
    }
  }
}

// School Operations
const v11SchoolOpsY = (y) => {
  const lines = ['board_expenses', 'classroom_supplies', 'sped_supplies', 'textbooks', 'supplies_other', 'equipment_furniture', 'telephone', 'technology', 'testing', 'field_trips', 'transportation_student', 'student_services_other', 'office_expense', 'staff_development', 'staff_recruitment', 'marketing', 'school_meals', 'stipends', 'fundraising_exp', 'extracurricular', 'misc_ops', 'all_other_school_ops'];
  return lines.reduce((s, k) => s + (v11Val('expenses_detail', k, `y${y}`) ?? 0), 0);
};
const slSchoolOpsY = (y) =>
  slOps(y, 'supplies') + slOps(y, 'technology') + slOps(y, 'curriculum') + slOps(y, 'profDev') +
  slOps(y, 'marketing') + slOps(y, 'fundraising') + slOps(y, 'foodService') + slOps(y, 'transportation');

for (let y = 1; y <= 5; y++) {
  const v11Tot = v11SchoolOpsY(y);
  const slTot = slSchoolOpsY(y);
  const delta = slTot - v11Tot;
  classifications.push({
    line: 'Expenses · School Operations (V11 group total)',
    year: y,
    v11_value: v11Tot,
    sl_value: slTot,
    delta_dollars: Math.round(delta),
    delta_pct: fmtPct(delta, v11Tot),
    classification: 'Split: D2 (fixture) + B (platform)',
    sub_category: 'D2 + B',
    rationale: 'V11 School Operations bundles 22 sub-lines (Board, Supplies, Textbooks, Technology, Testing, Field Trips, Transportation, Office Expense, Staff Dev, Staff Recruitment, Marketing, School Meals, Stipends, Fundraising, Extracurricular, Misc, etc.). SL has 8 abstract per-student lines (Supplies, Technology, Curriculum, ProfDev, Marketing, Fundraising, FoodService, Transportation). Two distinct gaps: (1) fixture used SL defaults; if Cedar Grove\'s Y2 ~$924K were entered as overrides, SL\'s coarser structure could carry the totals (D2 fixture-fidelity); (2) Cedar Grove\'s itemization (Stipends/Bonuses, Extracurricular, Field Trips, Staff Recruitment as separate lines) cannot be entered in SL — requires NEW BACKLOG entry for line-type expansion (B platform-modeling).',
    backlog_ref: 'D2 part: re-enter in fixture. B part: NEW candidate — expense-line itemization (Stipends, Extracurricular, Field Trips, Staff Recruitment, Board Expenses).',
  });
}

// Facility O&M
const v11FacilityY = (y) => {
  const lines = ['insurance', 'janitorial', 'rent_lease', 'repairs_maintenance', 'facility_equipment', 'security', 'utilities', 'all_other_facilities'];
  return lines.reduce((s, k) => s + (v11Val('expenses_detail', k, `y${y}`) ?? 0), 0);
};
const slFacilityY = (y) => slOps(y, 'facilities') + slOps(y, 'insurance');

for (let y = 1; y <= 5; y++) {
  const v11Tot = v11FacilityY(y);
  const slTot = slFacilityY(y);
  const delta = slTot - v11Tot;
  classifications.push({
    line: 'Expenses · Facility O&M (V11 group total)',
    year: y,
    v11_value: v11Tot,
    sl_value: slTot,
    delta_dollars: Math.round(delta),
    delta_pct: fmtPct(delta, v11Tot),
    classification: 'Split: D2 (fixture) + B (platform)',
    sub_category: 'D2 + B',
    rationale: 'V11 Facility O&M bundles 8 sub-lines (Insurance, Janitorial, Rent/Lease, Repairs/Maintenance, Equipment, Security, Utilities, Other). SL has "Facilities" (single $/mo lease number) + "Insurance" (annual flat). Two gaps: (1) fixture used SL default $15K/mo lease; Cedar Grove V11 has rent $240K Y2 + $300K Y3-Y5; (2) sub-lines for Janitorial, Repairs/Maint, Security, Utilities, Equipment cannot be itemized — NEW BACKLOG candidate for line-type expansion.',
    backlog_ref: 'D2 part: re-enter rent. B part: NEW candidate — facility O&M itemization (Janitorial, R&M, Security, Utilities, Equipment).',
  });
}

// Authorizer Fee — already counted in Contracted Services group above; surface separately for analysis
// ADJUDICATED 2026-05-23 → C (Defensible formula difference), R-REV-06.
// 5.5% Y1 delta within explainable bounds (SSE inclusion or regionalization order).
// R-REV-06 investigation still warranted but not urgent. Don't surface in executive summary.
reconcile('Expenses · Authorizer Fee (Oversight Fee 3%)', 'expenses_detail', 'authorizer_fee',
  (y) => slOps(y, 'authorizerFee'),
  (y, v, s) => ({
    classification: 'Defensible formula difference',
    rationale: 'Both compute as 3% × state revenue. Y1 V11 = $100,974, SL = $106,552 (5.5% high). Within explainable bounds — likely SSE inclusion in base or regionalization-multiplier order. R-REV-06 is verifying against the actual WSCSC contract language. Not material enough to surface in executive summary.',
    backlog_ref: 'R-REV-06',
  }));

// Depreciation
reconcile('Expenses · Depreciation & Amortization', 'expenses_detail', 'depreciation',
  () => 0,
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has Cedar Grove\'s building depreciation of $172,500/yr (from $5.175M facility at 30-year amortization). SL has no depreciation field anywhere in financial_assumptions or budget_projections. Missing line type — NEW BACKLOG candidate.',
    backlog_ref: 'NEW: P-FIN-XX Facility depreciation modeling',
  }));

// Interest Expense
reconcile('Expenses · Interest Expense (facility debt service)', 'expenses_detail', 'interest_expense',
  () => 0,
  (y, v, s) => ({
    classification: 'Missing line type',
    rationale: 'V11 has Cedar Grove\'s facility debt interest declining over the amortization schedule (Y1 ~$257K → Y5 ~$240K). SL has no facility-debt or interest-expense model. Missing line type — NEW BACKLOG candidate.',
    backlog_ref: 'NEW: P-FIN-XX Facility debt service modeling',
  }));

// Contingency (V11 has $0; SL applies 2% default)
for (let y = 1; y <= 5; y++) {
  classifications.push({
    line: 'Expenses · Contingency / Reserves',
    year: y,
    v11_value: v11Val('expenses_detail', 'contingency_reserves', `y${y}`) ?? 0,
    sl_value: slOps(y, 'contingency'),
    delta_dollars: Math.round(slOps(y, 'contingency') - (v11Val('expenses_detail', 'contingency_reserves', `y${y}`) ?? 0)),
    delta_pct: null,
    classification: 'Not-bug (D2 — V11 modeler choice)',
    sub_category: 'D2',
    rationale: 'V11 has contingency at $0 (Cedar Grove modeler chose not to budget contingency). SL applies 2% default. Defensible default in both; this is a configuration choice, not a platform difference.',
    backlog_ref: 'Spec doc / setting visible in Settings',
  });
}

// ============================================================
// BOTTOM LINE
// ============================================================

reconcile('Bottom line · Total Revenue', 'revenue_subtotals', 'total_revenue',
  (y) => slTotalRev(y),
  (y, v, s) => ({
    classification: 'Derived (composite of revenue lines above)',
    rationale: 'See revenue line classifications above. Y1 gap of ~$943K decomposes mainly into: missing line types (Title II/III, 4199 Transportation, 6100, 4198 State Food) + CSP semantic + philanthropy not entered + defensible formula differences (LAP, TBIP, HiCap, Title I, IDEA, BEA regionalization).',
    backlog_ref: 'Composite — see contributors',
  }));

reconcile('Bottom line · Total Expenses', 'expenses_totals', 'total_expenses',
  (y) => slTotalExp(y),
  (y, v, s) => ({
    classification: 'Derived (composite of expense lines above)',
    rationale: 'See expense line classifications above. Y1 gap of ~$1.74M decomposes into: depreciation ($172.5K, B+NEW), facility debt interest ($257K, B+NEW), Contracted Services + School Ops + Facility O&M fixture-fidelity gap (~$1.3M, D2 — re-enter Cedar Grove\'s actual values to close most of this), and the contingency/regionalization micro-deltas.',
    backlog_ref: 'Composite — see contributors',
  }));

for (let y = 1; y <= 5; y++) {
  const v11Net = v11.values.bottom_line[`net_income_y${y}`].value;
  classifications.push({
    line: 'Bottom line · Net Income',
    year: y,
    v11_value: v11Net,
    sl_value: slNet(y),
    delta_dollars: Math.round(slNet(y) - v11Net),
    delta_pct: fmtPct(slNet(y) - v11Net, v11Net),
    classification: 'Derived',
    rationale: 'Total Revenue − Total Expenses. SL\'s higher net is driven by the much lower expenses (see Total Expenses line). Once Cedar Grove\'s actual non-personnel categories are entered (D2 remediation) and depreciation/interest are modeled (B platform additions), the SL net should approach V11\'s ~$46K Y1 / ~$1.88M Y5.',
    backlog_ref: 'Composite',
  });
}

reconcile('Bottom line · Ending Cash (Cumulative)', null, null,
  (y) => slCumNet(y),
  (y, v, s) => {
    // Y1 V11 ending cash = DASHBOARD!C25 = unrestricted_cash
    const v11Cash = v11.values.bottom_line.unrestricted_cash?.[`y${y}`]?.value ?? null;
    return {
      classification: 'Derived',
      rationale: 'V11 takes ending cash from DASHBOARD!C25-G25; SL accumulates net per year onto preOpeningNet. Same shape; values diverge with the net delta.',
      backlog_ref: 'Composite',
      v11_value_override: v11Cash,
    };
  });
// Fix the v11_value
{
  for (let y = 1; y <= 5; y++) {
    const c = classifications.find((x) => x.line === 'Bottom line · Ending Cash (Cumulative)' && x.year === y);
    if (c) {
      c.v11_value = c.v11_value_override ?? 0;
      c.delta_dollars = Math.round(c.sl_value - c.v11_value);
      c.delta_pct = fmtPct(c.delta_dollars, c.v11_value);
      delete c.v11_value_override;
    }
  }
}

reconcile('Bottom line · DCOH (Days Cash on Hand)', null, null,
  (y) => slDCOH(y),
  (y, v, s) => {
    const v11Dcoh = v11.values.bottom_line.dcoh_or_label_mismatch?.[`y${y}`]?.value ?? null;
    return {
      classification: 'Derived',
      rationale: 'Same formula both sides: ending cash ÷ (expenses ÷ 365). Values diverge because both numerator and denominator differ per line classifications above. SL\'s higher DCOH (231 vs 103 Y1) reflects lower expenses + higher cash.',
      backlog_ref: 'Composite',
      v11_value_override: v11Dcoh,
    };
  });
{
  for (let y = 1; y <= 5; y++) {
    const c = classifications.find((x) => x.line === 'Bottom line · DCOH (Days Cash on Hand)' && x.year === y);
    if (c) {
      c.v11_value = c.v11_value_override ?? 0;
      c.delta_dollars = Math.round(c.sl_value - c.v11_value);
      c.delta_pct = fmtPct(c.delta_dollars, c.v11_value);
      delete c.v11_value_override;
    }
  }
}

// ============================================================
// STAFFING
// ============================================================

for (let y = 1; y <= 5; y++) {
  const v11True = v11.values.staffing.total_fte_per_position_sum[`y${y}`].value;
  const v11Buggy = v11.values.staffing.total_fte_r85_displayed[`y${y}`].value;
  const slFte = sl.staffing_summary_per_year[y - 1].total_fte;
  classifications.push({
    line: 'Staffing · Total FTE (true per-position sum)',
    year: y,
    v11_value: v11True,
    sl_value: slFte,
    delta_dollars: Math.round(slFte - v11True),
    delta_pct: fmtPct(slFte - v11True, v11True),
    classification: 'Not-bug (match — SL correct, V11 R85 displayed wrong)',
    sub_category: 'D1',
    rationale: 'SL Total FTE matches V11 per-position sum exactly. Comparing against V11\'s displayed R85 total (which is buggy due to truncated SUM range) shows SL "too high" by 1.5-4.0 FTE per year — that "too high" is actually V11\'s under-count. See V11 template defect §10.1.',
    backlog_ref: 'V11 template defect — communicate to ESWA/WSCSC for V12. No SL change needed.',
  });
  classifications.push({
    line: 'Staffing · Total FTE (V11 R85 buggy displayed)',
    year: y,
    v11_value: v11Buggy,
    sl_value: slFte,
    delta_dollars: Math.round(slFte - v11Buggy),
    delta_pct: fmtPct(slFte - v11Buggy, v11Buggy),
    classification: 'Not-bug (D1 — V11 template defect)',
    sub_category: 'D1',
    rationale: 'V11\'s displayed total at STAFFING!E85-J85 uses SUM(...:E77) which excludes rows 78-83 (Nurse, Librarian, Manager of Student Support, College & Athletics Director, Manager of College Success, Coordinator of College Success). Cedar Grove uses positions in those rows. SL\'s value is correct against V11\'s underlying data.',
    backlog_ref: 'V11 template defect — V12 fix recommended.',
  });
}

// Personnel % of Revenue
for (let y = 1; y <= 5; y++) {
  const v11Rev = v11.values.revenue_subtotals.total_revenue[`y${y}`].value;
  const v11Pers = (v11.values.expenses_totals.total_personnel_services_costs[`y${y}`].value ?? 0) +
                  (v11.values.expenses_totals.total_taxes_benefits[`y${y}`].value ?? 0);
  const v11Pct = v11Rev > 0 ? Math.round((v11Pers / v11Rev) * 1000) / 10 : null;
  const slRev = slTotalRev(y);
  const slPers = slPersTotal(y);
  const slPct = slRev > 0 ? Math.round((slPers / slRev) * 1000) / 10 : null;
  classifications.push({
    line: 'Bottom line · Personnel % of Revenue',
    year: y,
    v11_value: v11Pct,
    sl_value: slPct,
    delta_dollars: null,
    delta_pct: null,
    delta_pp: v11Pct != null && slPct != null ? Math.round((slPct - v11Pct) * 10) / 10 : null,
    classification: 'Derived',
    rationale: 'Personnel ÷ Total Revenue. V11 ~54% Y1, SL ~63% Y1 (because SL revenue base is lower). Once revenue gap closes (D2 + B fixes), this ratio will converge.',
    backlog_ref: 'Composite',
  });
}

// Write output
const outPath = path.resolve('tests/audit/v11-cedar-grove/session2/classifications.json');
const grouped = {};
for (const c of classifications) {
  if (!grouped[c.line]) grouped[c.line] = [];
  grouped[c.line].push(c);
}
fs.writeFileSync(outPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  total_lines: Object.keys(grouped).length,
  total_classifications: classifications.length,
  classifications,
  by_line: grouped,
}, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Total lines: ${Object.keys(grouped).length}; total (line × year) entries: ${classifications.length}`);

// Print needs-decision summary
const needsDecision = classifications.filter((c) => c.classification === 'Needs decision');
const needsDecisionByLine = {};
for (const c of needsDecision) {
  if (!needsDecisionByLine[c.line]) needsDecisionByLine[c.line] = [];
  needsDecisionByLine[c.line].push(c);
}
console.log(`\n=== CHECKPOINT B — Needs-Decision items: ${Object.keys(needsDecisionByLine).length} unique lines (${needsDecision.length} year-entries) ===\n`);
for (const [line, entries] of Object.entries(needsDecisionByLine)) {
  const first = entries[0];
  console.log(`* ${line}`);
  console.log(`  Candidates: ${(first.candidate_categories ?? ['(none — awaiting external interpretation)']).join(' | ')}`);
  console.log(`  Rationale:  ${first.rationale}`);
  console.log(`  BACKLOG:    ${first.backlog_ref}`);
  console.log(`  Years affected: ${entries.map(e => `Y${e.year} (V11=${fmt(e.v11_value)}, SL=${fmt(e.sl_value)})`).join('; ')}`);
  console.log('');
}

function fmt(n) {
  if (n == null) return 'null';
  if (typeof n !== 'number') return String(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Print category counts
const counts = {};
for (const c of classifications) {
  const k = c.classification;
  counts[k] = (counts[k] ?? 0) + 1;
}
console.log('\n=== Classification counts ===');
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(3)} | ${k}`);
}
