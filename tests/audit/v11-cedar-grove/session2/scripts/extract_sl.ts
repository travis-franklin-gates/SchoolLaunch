// SchoolLaunch value extraction — invokes computeMultiYearDetailed + computeFPFScorecard
// against the Cedar Grove fixture data, then writes sl_values.json.
import fs from 'node:fs';
import path from 'node:path';
import { computeMultiYearDetailed, computeFPFScorecard } from '../../../../../src/lib/budgetEngine';
import type {
  SchoolProfile,
  StaffingPosition,
  BudgetProjection,
  FinancialAssumptions,
  GradeExpansionEntry,
} from '../../../../../src/lib/types';
import { DEFAULT_ASSUMPTIONS } from '../../../../../src/lib/types';

// Load Supabase data exported by Phase 2.1 ad-hoc queries.
const positionsPath = path.resolve('tests/audit/v11-cedar-grove/session2/scripts/out/sl_positions.json');
const positions: StaffingPosition[] = JSON.parse(fs.readFileSync(positionsPath, 'utf8'));

// Profile data — pasted from MCP query (compact form so we don't depend on .env credentials)
const profile: SchoolProfile = {
  id: '1b9e9591-0d35-44b0-b742-6c7a30c6a548',
  school_id: '63fedd25-90b0-4078-9854-7ec7071e0fb2',
  grade_config: '6-12',
  region: 'spokane_county',
  pct_iep: 16,
  pct_frl: 60,
  pct_ell: 13,
  pct_hicap: 0,
  max_class_size: 24,
  planned_open_year: 2027,
  target_enrollment_y1: 240,
  target_enrollment_y2: 480,
  target_enrollment_y3: 690,
  target_enrollment_y4: 780,
  target_enrollment_y5: 780,
  retention_rate: 100,
  per_pupil_rate: 15000,
  opening_grades: ['6', '9'],
  buildout_grades: ['6', '7', '8', '9', '10', '11', '12'],
  startup_funding: [],
  pre_opening_expenses: [],
  pre_opening_transactions: [],
  custom_revenue_lines: [],
  fiscal_year_start_month: 9,
  financial_assumptions: {
    aafte_pct: 95,
    per_pupil_rate: 12613,
    sped_per_pupil: 455,
    contingency_pct: 2,
    insurance_annual: 18000,
    revenue_cola_pct: 3,
    benefits_load_pct: 30,
    ops_escalator_pct: 2,
    title_i_per_pupil: 880,
    authorizer_fee_pct: 3,
    fundraising_annual: 15000,
    facilities_per_pupil: 0,
    food_service_offered: true,
    regular_ed_per_pupil: 12613,
    salary_escalator_pct: 3,
    state_sped_per_pupil: 14631,
    supplies_per_student: 200,
    interest_rate_on_cash: 3,
    marketing_per_student: 200,
    curriculum_per_student: 500,
    regionalization_factor: 1.03,
    technology_per_student: 180,
    transportation_offered: false,
    levy_equity_per_student: 0,
    food_service_per_student: 1200,
    lap_per_pupil: 816,
    idea_per_pupil: 1500,
    tbip_per_pupil: 1600,
    hicap_per_pupil: 730,
    lap_high_poverty_per_pupil: 374,
    transportation_per_student: 800,
    food_service_revenue_per_pupil: 710,
    contracted_services_per_student: 150,
    professional_development_per_fte: 1000,
    transportation_revenue_per_pupil: 560,
  } as FinancialAssumptions,
} as unknown as SchoolProfile;

// Budget projections — only Y1 in DB; Y2-Y5 are computed
const projections: BudgetProjection[] = [
  { id: 'd8a9163b', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Authorizer Fee',          amount: 102005, is_revenue: false },
  { id: '53e3b8bf', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Contracted Services',     amount: 36000,  is_revenue: false },
  { id: 'a34be2f1', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Curriculum & Materials',  amount: 120000, is_revenue: false },
  { id: '675e843d', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Facilities',              amount: 180000, is_revenue: false },
  { id: 'f7a147d2', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Food Service',            amount: 0,      is_revenue: false },
  { id: '4eb83152', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Fundraising',             amount: 15000,  is_revenue: false },
  { id: '54606e07', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Insurance',               amount: 18000,  is_revenue: false },
  { id: '35e819fd', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Marketing & Outreach',    amount: 48000,  is_revenue: false },
  { id: '847fff50', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Misc/Contingency',        amount: 40150,  is_revenue: false },
  { id: '050d3c12', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Professional Development',amount: 18000,  is_revenue: false },
  { id: '51a7942c', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Supplies & Materials',    amount: 48000,  is_revenue: false },
  { id: 'ddea4f55', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Technology',              amount: 43200,  is_revenue: false },
  { id: '937eb100', school_id: profile.school_id, year: 1, category: 'Operations', subcategory: 'Transportation',          amount: 0,      is_revenue: false },
  { id: 'f471c101', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'Facilities Revenue',      amount: 0,      is_revenue: true },
  { id: '1160ec09', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'HiCap',                    amount: 0,      is_revenue: true },
  { id: '74822689', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'IDEA',                     amount: 57600,  is_revenue: true },
  { id: '1b8dfc0c', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'LAP',                      amount: 117504, is_revenue: true },
  { id: '067172f9', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'LAP High Poverty',         amount: 53856,  is_revenue: true },
  { id: '2b65ea9f', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'Levy Equity',              amount: 0,      is_revenue: true },
  { id: 'cccfef7c', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'Regular Ed Apportionment', amount: 2773848, is_revenue: true },
  { id: 'f33d060b', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'Small School Enhancement', amount: 0,      is_revenue: true },
  { id: '96f35774', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'SPED Apportionment',       amount: 95724,  is_revenue: true },
  { id: 'e4ea6afd', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'State Special Education',  amount: 530594, is_revenue: true },
  { id: '1e24d039', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'TBIP',                     amount: 49920,  is_revenue: true },
  { id: 'd566ff62', school_id: profile.school_id, year: 1, category: 'Revenue',    subcategory: 'Title I',                  amount: 126720, is_revenue: true },
] as BudgetProjection[];

// Grade expansion plan
const gradeExpansionPlan: GradeExpansionEntry[] = [
  { school_id: profile.school_id, year: 1, grade_level: '6', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 1, grade_level: '9', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 2, grade_level: '6', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 2, grade_level: '7', sections: 5, students_per_section: 24, is_new_grade: true },
  { school_id: profile.school_id, year: 2, grade_level: '9', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 2, grade_level: '10', sections: 5, students_per_section: 24, is_new_grade: true },
  { school_id: profile.school_id, year: 3, grade_level: '6', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 3, grade_level: '7', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 3, grade_level: '8', sections: 5, students_per_section: 24, is_new_grade: true },
  { school_id: profile.school_id, year: 3, grade_level: '9', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 3, grade_level: '10', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 3, grade_level: '11', sections: 3, students_per_section: 30, is_new_grade: true },
  { school_id: profile.school_id, year: 4, grade_level: '6', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 4, grade_level: '7', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 4, grade_level: '8', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 4, grade_level: '9', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 4, grade_level: '10', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 4, grade_level: '11', sections: 3, students_per_section: 30, is_new_grade: false },
  { school_id: profile.school_id, year: 4, grade_level: '12', sections: 3, students_per_section: 30, is_new_grade: true },
  { school_id: profile.school_id, year: 5, grade_level: '6', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 5, grade_level: '7', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 5, grade_level: '8', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 5, grade_level: '9', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 5, grade_level: '10', sections: 5, students_per_section: 24, is_new_grade: false },
  { school_id: profile.school_id, year: 5, grade_level: '11', sections: 3, students_per_section: 30, is_new_grade: false },
  { school_id: profile.school_id, year: 5, grade_level: '12', sections: 3, students_per_section: 30, is_new_grade: false },
] as GradeExpansionEntry[];

// Y1 positions only (for the legacy fallback path inside the engine)
const y1Positions = positions.filter((p) => p.year === 1).map((p) => ({
  ...p,
  fte: Number(p.fte),
  annual_salary: Number(p.annual_salary),
}));
const allPositionsNormalized = positions.map((p) => ({
  ...p,
  fte: Number(p.fte),
  annual_salary: Number(p.annual_salary),
}));

// Pre-opening net — Cedar Grove starts Y1 with $1.25M Y0 cash + Y0 spend.
// Cedar Grove V11 Y0: $250K philanthropy in, $278K spend, net -$22.4K, starting Y0 cash $1.25M.
// SL fixture has no Y0 pre-opening transactions seeded — preOpeningNet = profile starting balance only.
// To approximate Y0 starting cash of $1.25M (matching V11), use 1,250,000. Without explicit Y0 net,
// SL would default to 0. Document this in the report.
const preOpeningNet = 1_250_000;

const detailed = computeMultiYearDetailed(
  profile,
  y1Positions as StaffingPosition[],
  projections,
  profile.financial_assumptions as FinancialAssumptions,
  preOpeningNet,
  gradeExpansionPlan,
  allPositionsNormalized as StaffingPosition[],
  null, // no startup funding (per Session 1 — blocked by P-UX-11)
);

// FPF Scorecard
const summaryRows = detailed.map((row) => ({
  year: row.year,
  enrollment: row.enrollment,
  totalRevenue: row.revenue.total,
  totalExpenses: row.totalExpenses,
  netPosition: row.net,
  cumulativeNet: row.cumulativeNet,
  reserveDays: row.reserveDays,
  totalPersonnel: row.personnel.total,
  operatingRevenue: row.revenue.operatingRevenue,
}));

// computeFPFScorecard signature: (multiYear: MultiYearDetailedRow[], profile, assumptions, gradeExpansion?)
// Verify signature
const fpf = computeFPFScorecard(
  detailed,
  profile,
  profile.financial_assumptions as FinancialAssumptions,
  gradeExpansionPlan,
);

const out = {
  extracted_at: new Date().toISOString(),
  source: 'computeMultiYearDetailed + computeFPFScorecard via tsx',
  fixture: {
    school_id: profile.school_id,
    school_name: 'Cedar Grove Public Schools - V11 Test',
    pre_opening_net_assumed: preOpeningNet,
    note_on_pre_opening: 'V11 Y0 starting cash $1.25M with Y0 net -$22.4K → Y1 starting cash $1,227,620. Fixture has no Y0 transactions; using $1,250,000 as proxy.',
  },
  multiyear_detailed: detailed,
  summary_per_year: summaryRows,
  fpf,
  budget_projections_y1: projections,
  staffing_summary_per_year: [1, 2, 3, 4, 5].map((y) => {
    const yp = allPositionsNormalized.filter((p) => p.year === y);
    const totalFte = yp.reduce((s, p) => s + Number(p.fte), 0);
    const totalSalaries = yp.reduce((s, p) => s + Number(p.fte) * Number(p.annual_salary), 0);
    return { year: y, position_rows: yp.length, total_fte: totalFte, total_salaries: totalSalaries };
  }),
};

const outPath = path.resolve('tests/audit/v11-cedar-grove/session2/sl_values.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}`);

console.log('\n=== Year-by-year summary ===');
for (const row of detailed) {
  console.log(`Y${row.year}: enr=${row.enrollment}, rev=${Math.round(row.revenue.total).toLocaleString()}, exp=${Math.round(row.totalExpenses).toLocaleString()}, net=${Math.round(row.net).toLocaleString()}, cumCash=${Math.round(row.cumulativeNet).toLocaleString()}, DCOH=${row.reserveDays}`);
}
console.log('\n=== FPF Y1 ===');
console.log(JSON.stringify(fpf.measures?.map((m: any) => ({ name: m.name, y1: m.years?.[0] })) ?? fpf, null, 2).slice(0, 2000));
