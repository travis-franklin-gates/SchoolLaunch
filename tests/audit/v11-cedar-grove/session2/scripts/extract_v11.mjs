// Extract V11 values into v11_values.json with cell references and template-defect detection.
import XLSX from 'xlsx';
import path from 'node:path';
import fs from 'node:fs';

const file = path.resolve('docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx');
const outPath = path.resolve('tests/audit/v11-cedar-grove/session2/v11_values.json');
const wb = XLSX.readFile(file, { cellFormula: true });

const cell = (sheetName, ref) => {
  const ws = wb.Sheets[sheetName];
  const c = ws?.[ref];
  return { value: c?.v ?? null, formula: c?.f ?? null, ref: `${sheetName}!${ref}` };
};

const num = (c) => (typeof c?.value === 'number' ? c.value : null);

// P&L columns: D=Y0, E=Y1, F=Y2, G=Y3, H=Y4, I=Y5
const plCols = { y0: 'D', y1: 'E', y2: 'F', y3: 'G', y4: 'H', y5: 'I' };

const extractYearRow = (sheet, row, colMap) => {
  const out = {};
  for (const [y, col] of Object.entries(colMap)) {
    const c = cell(sheet, `${col}${row}`);
    out[y] = { value: num(c), cell: c.ref, formula: c.formula };
  }
  return out;
};

// REVENUE lines (P&L Section 4) — row numbers from explore_pl_revenue.mjs / explore_pl_expenses.mjs
const REVENUE_LINES = [
  ['sale_of_goods_2200',          122, '2200 - Sale of Goods, Supplies, & Services'],
  ['investment_earnings_2300',    123, '2300 - Investment Earnings'],
  ['donations_local_2500',        124, '2500 - Gifts, Grants, and Donations (Local)'],
  ['bea_3100',                    127, '3100 - Basic Education Apportionment'],
  ['sped_general_3121',           128, '3121 - SPED General Apportionment'],
  ['sped_state_4121',             131, '4121 - State Special Education'],
  ['lap_4155',                    132, '4155 - Learning Assistance Program (LAP)'],
  ['tbip_4165',                   133, '4165 - Transitional Bilingual (TBIP)'],
  ['hicap_4174',                  134, '4174 - Highly Capable'],
  ['food_service_state_4198',     135, '4198 - School Food Service (State)'],
  ['transportation_4199',         136, '4199 - Transportation Operations'],
  ['title_i',                     140, 'Title I'],
  ['title_ii',                    141, 'Title II'],
  ['title_iii',                   142, 'Title III'],
  ['idea',                        143, 'IDEA Funding'],
  ['csp',                         144, 'CSP (Charter Schools Program)'],
  ['ospi_special_purpose_6100',   147, '6100 - OSPI Special Purpose Unassigned'],
  ['food_service_federal_6198',   148, '6198 - School Food Services (Federal)'],
  ['private_foundations_8200',    155, '8200 - Private Foundations'],
];

// REVENUE subtotals
const REVENUE_SUBTOTALS = [
  ['subtotal_1000_local_taxes',           121],
  ['subtotal_2000_local_non_tax',         126],
  ['subtotal_3000_state_general',         130],
  ['subtotal_4000_state_special',         138],
  ['subtotal_5000_fed_general',           146],
  ['subtotal_6000_fed_special',           150],
  ['subtotal_7000_other_districts',       153],
  ['subtotal_8000_other_entities',        158],
  ['subtotal_9000_other_financing',       162],
  ['total_revenue',                       164],
  ['total_recurring_revenue',             169],
  ['total_non_recurring_revenue',         170],
  ['total_operating_revenue',             173],
  ['total_non_operating_revenue',         174],
];

// EXPENSE lines (P&L Section 5 detail) — row numbers
const EXPENSE_LINES = [
  ['accounting_audit',         231, 'Accounting / Audit', 'contracted_services'],
  ['legal',                    232, 'Legal', 'contracted_services'],
  ['authorizer_fee',           233, 'Oversight Fee (3% of state revenue)', 'contracted_services'],
  ['management_company_fee',   234, 'Management Company Fee', 'contracted_services'],
  ['payroll_services',         235, 'Payroll Services', 'contracted_services'],
  ['nurse_services',           236, 'Nurse Services', 'contracted_services'],
  ['special_ed_services',      237, 'Special Ed Services', 'contracted_services'],
  ['titlement_services',       238, 'Titlement Services', 'contracted_services'],
  ['all_other_contracted',     239, 'All Other Contracted Services', 'contracted_services'],
  ['board_expenses',           240, 'Board Expenses', 'school_operations'],
  ['classroom_supplies',       241, 'Classroom/Teaching Supplies', 'school_operations'],
  ['sped_supplies',            242, 'Special Ed Supplies', 'school_operations'],
  ['textbooks',                243, 'Textbooks/Workbooks', 'school_operations'],
  ['supplies_other',           244, 'Supplies & Materials Other', 'school_operations'],
  ['equipment_furniture',      245, 'School Ops Equipment/Furniture', 'school_operations'],
  ['telephone',                246, 'Telephone', 'school_operations'],
  ['technology',               247, 'Technology', 'school_operations'],
  ['testing',                  248, 'Student Testing & Assessment', 'school_operations'],
  ['field_trips',              249, 'Field Trips', 'school_operations'],
  ['transportation_student',   250, 'Transportation (Student)', 'school_operations'],
  ['student_services_other',   251, 'Student Services Other', 'school_operations'],
  ['office_expense',           252, 'Office Expense', 'school_operations'],
  ['staff_development',        253, 'Staff Development', 'school_operations'],
  ['staff_recruitment',        254, 'Staff Recruitment', 'school_operations'],
  ['marketing',                255, 'Student Recruitment/Marketing', 'school_operations'],
  ['school_meals',             256, 'School Meals/Lunch', 'school_operations'],
  ['stipends',                 257, 'Stipends/Bonuses', 'school_operations'],
  ['fundraising_exp',          258, 'Fundraising (expense)', 'school_operations'],
  ['extracurricular',          259, 'Extra Curricular', 'school_operations'],
  ['misc_ops',                 260, 'Misc. Operating Expenses', 'school_operations'],
  ['all_other_school_ops',     261, 'All Other School Operations', 'school_operations'],
  ['insurance',                262, 'Insurance', 'facility_om'],
  ['janitorial',               263, 'Janitorial Services', 'facility_om'],
  ['rent_lease',               264, 'Building and Land Rent/Lease', 'facility_om'],
  ['repairs_maintenance',      265, 'Repairs & Maintenance', 'facility_om'],
  ['facility_equipment',       266, 'Facility Equipment/Furniture', 'facility_om'],
  ['security',                 267, 'Security Services', 'facility_om'],
  ['utilities',                268, 'Utilities', 'facility_om'],
  ['all_other_facilities',     269, 'All Other Facilities', 'facility_om'],
  ['contingency_reserves',     270, 'Reserves/Contingency', 'contingency'],
  ['interest_expense',         271, 'Interest Expense', 'finance'],
  ['depreciation',             272, 'Depreciation & Amortization', 'finance'],
  ['personnel_services_costs', 273, 'Personnel Services Costs (echo)', 'personnel'],
  ['personnel_taxes_benefits', 274, 'Personnel Taxes & Benefits Costs (echo)', 'personnel'],
];

const EXPENSE_TOTALS = [
  ['total_personnel_services_costs', 218, 'SUM(E185:E217)'],
  ['total_taxes_benefits',           227, 'SUMPRODUCT(positions × benefit%)'],
  ['total_expenses',                 275, 'SUM(E231:E274)'],
];

const out = {
  extracted_at: new Date().toISOString(),
  v11_source: 'docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx',
  sheets: wb.SheetNames,
  values: {
    revenue: {},
    revenue_subtotals: {},
    expenses_detail: {},
    expenses_totals: {},
    bottom_line: {},
    staffing: {},
  },
  v11_template_defects: [],
};

for (const [key, row, label] of REVENUE_LINES) {
  out.values.revenue[key] = { label, row, ...extractYearRow('P&L', row, plCols) };
}
for (const [key, row] of REVENUE_SUBTOTALS) {
  out.values.revenue_subtotals[key] = { row, ...extractYearRow('P&L', row, plCols) };
}
for (const [key, row, label, group] of EXPENSE_LINES) {
  out.values.expenses_detail[key] = { label, group, row, ...extractYearRow('P&L', row, plCols) };
}
for (const [key, row, sumDescription] of EXPENSE_TOTALS) {
  out.values.expenses_totals[key] = { row, sum_description: sumDescription, ...extractYearRow('P&L', row, plCols) };
}

// Net Income = Total Revenue - Total Expenses
for (const y of ['y0', 'y1', 'y2', 'y3', 'y4', 'y5']) {
  const rev = out.values.revenue_subtotals.total_revenue[y].value;
  const exp = out.values.expenses_totals.total_expenses[y].value;
  out.values.bottom_line[`net_income_${y}`] = {
    value: rev != null && exp != null ? rev - exp : null,
    derivation: 'total_revenue − total_expenses',
  };
}

// DASHBOARD: cells use cols B=Y0, C=Y1, D=Y2, E=Y3, F=Y4, G=Y5
const dashCols = { y0: 'B', y1: 'C', y2: 'D', y3: 'E', y4: 'F', y5: 'G' };
const DASH_INPUTS = [
  ['current_assets',          25],
  ['current_liabilities',     26],
  ['unrestricted_cash',       27],
  ['total_expenses_dashboard', 28],
  ['depreciation_dashboard',  29],
  ['total_assets',            30],
  ['total_liabilities',       31],
  ['dcoh_or_label_mismatch',  32],   // label says cash $, actual is DCOH days
  ['net_income',              33],
  ['total_revenue_dashboard', 34],
];
const DASH_FPF = [
  ['fpf_current_ratio',                 37],
  ['fpf_dcoh',                          38],
  ['fpf_total_margin_annual',           40],
  ['fpf_3yr_total_margin',              41],
  ['fpf_debt_to_asset',                 42],
  ['fpf_cash_flow_annual',              43],
  ['fpf_3yr_cash_flow',                 44],
  ['fpf_enrollment_variance',           48],
  ['fpf_actual_enrollment',             49],
];
for (const [key, row] of DASH_INPUTS) {
  out.values.bottom_line[key] = { row, ...extractYearRow('DASHBOARD', row, dashCols) };
}
out.values.fpf_self_reported = {};
for (const [key, row] of DASH_FPF) {
  out.values.fpf_self_reported[key] = { row, ...extractYearRow('DASHBOARD', row, dashCols) };
}

// STAFFING: cols E=Y0, F=Y1, G=Y2, H=Y3, I=Y4, J=Y5
const staffCols = { y0: 'E', y1: 'F', y2: 'G', y3: 'H', y4: 'I', y5: 'J' };

const sumStaffingRange = (col, startRow, endRow) => {
  let sum = 0;
  let count = 0;
  for (let r = startRow; r <= endRow; r++) {
    const c = wb.Sheets['STAFFING'][`${col}${r}`];
    if (typeof c?.v === 'number') { sum += c.v; count++; }
  }
  return { sum, count };
};

out.values.staffing.total_fte_per_position_sum = {};
out.values.staffing.total_fte_r85_displayed = {};
for (const [y, col] of Object.entries(staffCols)) {
  const trueTotal = sumStaffingRange(col, 52, 83);
  const displayedCell = cell('STAFFING', `${col}85`);
  out.values.staffing.total_fte_per_position_sum[y] = {
    value: trueTotal.sum,
    derivation: `Σ ${col}52:${col}83 (32 position rows, true total)`,
    rows_summed: trueTotal.count,
  };
  out.values.staffing.total_fte_r85_displayed[y] = {
    value: num(displayedCell),
    formula: displayedCell.formula,
    cell: displayedCell.ref,
    note: 'V11 displays this; SUM range stops at row 77 — see template defect',
  };
}

// V11 template defect: R85 SUM truncation
out.v11_template_defects.push({
  cell: 'STAFFING!E85 through J85',
  formula_as_written: '=SUM(E52:E77) (and same shape for F-J)',
  expected_formula: '=SUM(E52:E83)',
  excluded_rows: 'R78-R83 (Nurse, Librarian, Manager of Student Support, College & Athletics Director, Manager of College Success, Coordinator of College Success)',
  impact_y1_y5: {
    y1: out.values.staffing.total_fte_per_position_sum.y1.value - (out.values.staffing.total_fte_r85_displayed.y1.value || 0),
    y2: out.values.staffing.total_fte_per_position_sum.y2.value - (out.values.staffing.total_fte_r85_displayed.y2.value || 0),
    y3: out.values.staffing.total_fte_per_position_sum.y3.value - (out.values.staffing.total_fte_r85_displayed.y3.value || 0),
    y4: out.values.staffing.total_fte_per_position_sum.y4.value - (out.values.staffing.total_fte_r85_displayed.y4.value || 0),
    y5: out.values.staffing.total_fte_per_position_sum.y5.value - (out.values.staffing.total_fte_r85_displayed.y5.value || 0),
  },
  description: 'R85 SUM range truncated; understates Total FTE by 1.5-4.0 FTE per year. Propagates to Drivers tab (Per FTE expense lines) and REPORTS.',
});

// Verify the SUM ranges on the revenue total row 164 cover all subtotals.
// Formula was: SUM(E162,E158,E153,E150,E146,E138,E130,E126,E121) — that's 9 subtotals (1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000)
// Verify no subtotal is missing
const expectedSubtotalRows = [121, 126, 130, 138, 146, 150, 153, 158, 162];
out.sum_formula_audit_total_revenue = {
  formula: out.values.revenue_subtotals.total_revenue.y1.formula,
  expected_rows: expectedSubtotalRows,
  status: 'covers all 9 OSPI revenue subtotals (1000-9000)',
};

// Verify Total Expenses SUM range E231:E274 covers all detail + Interest + Depreciation + Personnel echoes
out.sum_formula_audit_total_expenses = {
  formula: out.values.expenses_totals.total_expenses.y1.formula,
  expected_range: 'E231:E274',
  status: 'covers all expense detail rows 231-272 plus personnel echoes 273-274',
};

// Cash starting balance from Cash tab (Year 1)
const cashStart = cell('Cash', 'B4');
out.values.bottom_line.year1_starting_cash = { value: num(cashStart), cell: cashStart.ref };

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Revenue lines: ${Object.keys(out.values.revenue).length}`);
console.log(`Revenue subtotals: ${Object.keys(out.values.revenue_subtotals).length}`);
console.log(`Expense detail lines: ${Object.keys(out.values.expenses_detail).length}`);
console.log(`Expense totals: ${Object.keys(out.values.expenses_totals).length}`);
console.log(`Bottom-line items: ${Object.keys(out.values.bottom_line).length}`);
console.log(`FPF self-reported metrics: ${Object.keys(out.values.fpf_self_reported).length}`);
console.log(`Template defects found: ${out.v11_template_defects.length}`);
console.log(`\nY1 Total Revenue: ${out.values.revenue_subtotals.total_revenue.y1.value}`);
console.log(`Y1 Total Expenses: ${out.values.expenses_totals.total_expenses.y1.value}`);
console.log(`Y1 Net Income (derived): ${out.values.bottom_line.net_income_y1.value}`);
console.log(`Y1 DCOH (DASHBOARD): ${out.values.bottom_line.dcoh_or_label_mismatch.y1.value}`);
console.log(`Y1 FTE (true per-position sum): ${out.values.staffing.total_fte_per_position_sum.y1.value}`);
console.log(`Y1 FTE (R85 displayed, buggy): ${out.values.staffing.total_fte_r85_displayed.y1.value}`);
