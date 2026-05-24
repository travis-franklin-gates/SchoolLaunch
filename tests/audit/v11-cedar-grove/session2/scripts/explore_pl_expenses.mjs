// Dump P&L Section 5 (Expenses) and subsequent rows including totals
import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve('docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx');
const wb = XLSX.readFile(file, { cellFormula: true });
const ws = wb.Sheets['P&L'];

const range = XLSX.utils.decode_range(ws['!ref']);
console.log(`P&L range: ${ws['!ref']}`);

// Dump rows 120-280 with key columns (B, C, E (Y1), I (Y5), and formula if SUM)
for (let r = 119; r < Math.min(range.e.r, 280); r++) {
  const b = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
  const c = ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v;
  const e = ws[XLSX.utils.encode_cell({ r, c: 4 })];
  const i = ws[XLSX.utils.encode_cell({ r, c: 8 })];
  if (b == null && c == null && e?.v == null) continue;
  const bStr = b != null ? String(b).slice(0, 35) : '';
  const cStr = c != null ? String(c).slice(0, 40) : '';
  const eVal = e?.v != null ? (typeof e.v === 'number' ? e.v.toFixed(0) : String(e.v).slice(0, 20)) : '';
  const iVal = i?.v != null ? (typeof i.v === 'number' ? i.v.toFixed(0) : String(i.v).slice(0, 20)) : '';
  const formula = e?.f ? `  [f: ${e.f.slice(0, 80)}]` : '';
  console.log(`r${r + 1}: B="${bStr}" C="${cStr}" | Y1=${eVal} Y5=${iVal}${formula}`);
}
