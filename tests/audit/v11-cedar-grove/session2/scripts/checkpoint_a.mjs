import fs from 'node:fs';
const v11 = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/v11_values.json', 'utf8'));
const sl = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/sl_values.json', 'utf8'));

const slY1 = sl.summary_per_year[0];
const slDetailed = sl.multiyear_detailed[0];

const fmt = (n) => {
  if (n == null) return 'n/a';
  if (typeof n !== 'number') return String(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
};
const pct = (a, b) => {
  if (b === 0 || b == null) return 'n/a';
  return ((a - b) / Math.abs(b) * 100).toFixed(1) + '%';
};
const row = (label, v11Val, slVal) => {
  const delta = (v11Val != null && slVal != null) ? slVal - v11Val : null;
  const dpct = (v11Val != null && slVal != null) ? pct(slVal, v11Val) : 'n/a';
  console.log(`| ${label.padEnd(25)} | ${fmt(v11Val).padStart(14)} | ${fmt(slVal).padStart(14)} | ${(delta != null ? (delta >= 0 ? '+' : '') + fmt(delta) : 'n/a').padStart(13)} | ${dpct.padStart(8)} |`);
};

console.log('\n=== CHECKPOINT A — Y1 raw deltas (V11 vs SchoolLaunch) ===\n');
console.log('| Line                      |        Y1 V11 |        Y1 SL  |      Y1 Δ$   |   Y1 Δ%  |');
console.log('|---------------------------|---------------|---------------|---------------|---------|');
row('Total Revenue', v11.values.revenue_subtotals.total_revenue.y1.value, slDetailed.revenue.total);
row('  Operating-only Revenue', v11.values.revenue_subtotals.total_operating_revenue.y1.value, slDetailed.revenue.operatingRevenue);
row('Total Expenses', v11.values.expenses_totals.total_expenses.y1.value, slDetailed.totalExpenses);
row('  Personnel (incl benefits)', v11.values.expenses_totals.total_personnel_services_costs.y1.value + v11.values.expenses_totals.total_taxes_benefits.y1.value, slDetailed.personnel.total);
row('Net Income', v11.values.bottom_line.net_income_y1.value, slDetailed.net);
row('Ending Cash (Y1 cum)', v11.values.bottom_line.unrestricted_cash.y1.value, slDetailed.cumulativeNet);
row('DCOH', v11.values.bottom_line.dcoh_or_label_mismatch.y1.value, slDetailed.reserveDays);
row('Total FTE (true)', v11.values.staffing.total_fte_per_position_sum.y1.value, sl.staffing_summary_per_year[0].total_fte);
row('Total FTE (V11 R85 buggy)', v11.values.staffing.total_fte_r85_displayed.y1.value, null);

console.log('\n=== Y2-Y5 quick sanity (Revenue / Net / DCOH) ===\n');
for (let y = 2; y <= 5; y++) {
  const sld = sl.multiyear_detailed[y - 1];
  const vRev = v11.values.revenue_subtotals.total_revenue[`y${y}`].value;
  const vExp = v11.values.expenses_totals.total_expenses[`y${y}`].value;
  const vNet = vRev - vExp;
  console.log(`Y${y}: V11 rev=${fmt(vRev)} exp=${fmt(vExp)} net=${fmt(vNet)} | SL rev=${fmt(sld.revenue.total)} exp=${fmt(sld.totalExpenses)} net=${fmt(sld.net)} DCOH=${sld.reserveDays}`);
}

console.log('\nCHECKPOINT A: raw values extracted. Y1 deltas above. Awaiting "proceed" before classification.');
