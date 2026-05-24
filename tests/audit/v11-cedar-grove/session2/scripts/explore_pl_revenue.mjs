// P&L Section 4 (Revenue) and Section 5 (Expense) — dump the year columns
import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve('docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx');
const wb = XLSX.readFile(file, { cellFormula: true });
const ws = wb.Sheets['P&L'];

const range = XLSX.utils.decode_range(ws['!ref']);
console.log(`P&L range: ${ws['!ref']}`);

// Look for the row labeled "Source" or similar that has Year 0/1/2/3/4/5 headers
// Try row 119 which had B="Source" C="Description" — Y columns may be D-I or beyond
for (const r of [116, 117, 118, 119, 120, 121, 182, 183, 184, 185]) {
  const cells = [];
  for (let c = 0; c < 16; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: r - 1, c })];
    if (cell?.v != null && cell.v !== '') {
      const v = typeof cell.v === 'number' ? cell.v : String(cell.v).slice(0, 30);
      cells.push(`${XLSX.utils.encode_col(c)}=${v}`);
    }
  }
  console.log(`row ${r}: ${cells.join(' | ')}`);
}

console.log('\n--- BEA row (127) ---');
for (let c = 0; c < 16; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 126, c })];
  if (cell?.v != null && cell.v !== '') {
    const v = typeof cell.v === 'number' ? cell.v : String(cell.v).slice(0, 40);
    const f = cell.f ? ` [f=${cell.f}]` : '';
    console.log(`  ${XLSX.utils.encode_col(c)}: ${v}${f}`);
  }
}
console.log('\n--- Total Revenue row (164) ---');
for (let c = 0; c < 16; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 163, c })];
  if (cell?.v != null && cell.v !== '') {
    const v = typeof cell.v === 'number' ? cell.v : String(cell.v).slice(0, 40);
    const f = cell.f ? ` [f=${cell.f}]` : '';
    console.log(`  ${XLSX.utils.encode_col(c)}: ${v}${f}`);
  }
}
