// Phase 4 — Compute FPF for both SL and V11 using the same computeFPFScorecard logic.
// Output: sl_fpf.json + v11_fpf.json (each with self-reported V11 metrics as well).
import fs from 'node:fs';
import path from 'node:path';
import { computeFPFScorecard } from '../../../../../src/lib/budgetEngine';
import type { MultiYearDetailedRow } from '../../../../../src/lib/budgetEngine';

const v11 = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/v11_values.json', 'utf8'));
const sl = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/sl_values.json', 'utf8'));

// ========== SL FPF ==========
const slMultiYear: MultiYearDetailedRow[] = sl.multiyear_detailed;
const slStartingCash = sl.fixture.pre_opening_net_assumed;
const slFpf = computeFPFScorecard(slMultiYear, slStartingCash, false);

const slFpfOut = {
  generated_at: new Date().toISOString(),
  source: 'src/lib/budgetEngine.ts:computeFPFScorecard',
  inputs: {
    starting_cash: slStartingCash,
    conservative_mode: false,
    multi_year_summary: slMultiYear.map((r) => ({
      year: r.year,
      enrollment: r.enrollment,
      operating_revenue: r.revenue.operatingRevenue,
      total_revenue: r.revenue.total,
      total_expenses: r.totalExpenses,
      net: r.net,
      cumulative_net: r.cumulativeNet,
    })),
  },
  scorecard: slFpf,
};
fs.writeFileSync(path.resolve('tests/audit/v11-cedar-grove/session2/sl_fpf.json'), JSON.stringify(slFpfOut, null, 2));
console.log('Wrote sl_fpf.json');

// ========== V11 FPF — recompute using identical thresholds ==========
// Build synthetic MultiYearDetailedRow shapes from V11 totals.
const years = ['y1', 'y2', 'y3', 'y4', 'y5'] as const;
const v11Rows: MultiYearDetailedRow[] = years.map((yKey, idx) => {
  const y = idx + 1;
  const totalRev = v11.values.revenue_subtotals.total_revenue[yKey].value as number;
  const operatingRev = v11.values.revenue_subtotals.total_operating_revenue[yKey].value as number;
  const totalExp = v11.values.expenses_totals.total_expenses[yKey].value as number;
  const net = totalRev - totalExp;
  const enrollment = [240, 480, 690, 780, 780][idx];
  return {
    year: y,
    enrollment,
    aafte: Math.round(enrollment * 0.95),
    revenue: {
      regularEd: 0, sped: 0, stateSped: 0, facilitiesRev: 0, levyEquity: 0,
      titleI: 0, idea: 0, lap: 0, lapHighPoverty: 0, tbip: 0, hicap: 0,
      foodServiceRev: 0, transportationRev: 0, smallSchoolEnhancement: 0,
      interestIncome: 0, grantRevenue: 0,
      operatingRevenue: operatingRev,
      total: totalRev,
      apportionment: 0,
    } as MultiYearDetailedRow['revenue'],
    personnel: { certificated: 0, classified: 0, admin: 0, benefits: 0, total: 0, totalSalaries: 0 } as MultiYearDetailedRow['personnel'],
    operations: { facilities: 0, supplies: 0, contracted: 0, technology: 0, authorizerFee: 0, insurance: 0, foodService: 0, transportation: 0, curriculum: 0, profDev: 0, marketing: 0, fundraising: 0, contingency: 0, total: 0 } as MultiYearDetailedRow['operations'],
    totalExpenses: totalExp,
    net,
    cumulativeNet: 0,
    reserveDays: 0,
    staffing: { teachers: 0, paras: 0, officeStaff: 0, otherStaff: 0, totalPositions: 27.25, totalPersonnelCost: 0, totalSalaries: 0, totalBenefits: 0 } as MultiYearDetailedRow['staffing'],
  } as MultiYearDetailedRow;
});

// V11 Y0 starting cash = 1,250,000 (V11 INPUTS!C21); V11 Y0 net = -22,380.
// Effective Y1 starting cash = 1,227,620 (matches V11!Cash!B4).
const v11StartingCash = 1_227_620;
const v11Fpf = computeFPFScorecard(v11Rows, v11StartingCash, false);

// V11 self-reported FPF from the DASHBOARD tab (already extracted)
const v11SelfReported = v11.values.fpf_self_reported;

const v11FpfOut = {
  generated_at: new Date().toISOString(),
  source: 'Recomputed via src/lib/budgetEngine.ts:computeFPFScorecard on V11 synthetic data',
  inputs: {
    starting_cash: v11StartingCash,
    conservative_mode: false,
    multi_year_summary: v11Rows.map((r) => ({
      year: r.year,
      enrollment: r.enrollment,
      operating_revenue: r.revenue.operatingRevenue,
      total_revenue: r.revenue.total,
      total_expenses: r.totalExpenses,
      net: r.net,
    })),
  },
  scorecard: v11Fpf,
  v11_self_reported_fpf: v11SelfReported,
  note: 'v11_self_reported values come from V11 DASHBOARD!B36:G48. Recomputed scorecard uses identical math against V11 totals.',
};
fs.writeFileSync(path.resolve('tests/audit/v11-cedar-grove/session2/v11_fpf.json'), JSON.stringify(v11FpfOut, null, 2));
console.log('Wrote v11_fpf.json');

// ========== Console summary ==========
console.log('\n=== FPF SCORECARD COMPARISON (Year 1) ===\n');
console.log('Measure                       | V11 SL-recomputed | SL recomputed     | V11 self-reported');
console.log('------------------------------|-------------------|-------------------|-------------------');
for (let i = 0; i < slFpf.measures.length; i++) {
  const m = slFpf.measures[i];
  const v11M = v11Fpf.measures.find((x) => x.name === m.name);
  const slVal = m.values[0];
  const v11Val = v11M?.values[0];
  const slStatus = m.statuses[0];
  const v11Status = v11M?.statuses[0];
  console.log(`${m.name.padEnd(29)} | ${String(v11Val).padStart(8)} ${String(v11Status).padEnd(8)} | ${String(slVal).padStart(8)} ${String(slStatus).padEnd(8)} | (see V11 DASHBOARD)`);
}
console.log(`\nSL overall:   ${slFpf.overallStatus.toUpperCase()} — ${slFpf.overallMessage}`);
console.log(`V11 overall:  ${v11Fpf.overallStatus.toUpperCase()} — ${v11Fpf.overallMessage}`);

console.log('\n=== Per-year DCOH ===');
const slDcoh = slFpf.measures.find((m) => m.name === 'Days of Cash')!;
const v11Dcoh = v11Fpf.measures.find((m) => m.name === 'Days of Cash')!;
console.log(`SL  DCOH Y1-Y5: ${slDcoh.values.join(', ')}`);
console.log(`V11 DCOH Y1-Y5: ${v11Dcoh.values.join(', ')}`);

console.log('\n=== Per-year Total Margin ===');
const slMargin = slFpf.measures.find((m) => m.name === 'Total Margin')!;
const v11Margin = v11Fpf.measures.find((m) => m.name === 'Total Margin')!;
console.log(`SL  margin Y1-Y5: ${slMargin.values.join('%, ')}%`);
console.log(`V11 margin Y1-Y5: ${v11Margin.values.join('%, ')}%`);
