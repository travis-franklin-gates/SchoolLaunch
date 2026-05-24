// Explore V11 structure — dump column A/B labels and the row that contains "Year 1" header
// for each key sheet so we can target the right cells.
import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve('docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx');
const wb = XLSX.readFile(file, { cellFormula: true });

const targetSheets = ['INPUTS', 'STAFFING', 'P&L', 'Cash', 'DASHBOARD', 'REPORTS', 'Balance Sheet'];

for (const sheetName of targetSheets) {
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.log(`(skip ${sheetName})`); continue; }
  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`\n========== ${sheetName} (range=${ws['!ref']}) ==========`);
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 200); r++) {
    // Get label from A (col 0) and B (col 1)
    const a = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const b = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    const c = ws[XLSX.utils.encode_cell({ r, c: 2 })];
    const aVal = a?.v;
    const bVal = b?.v;
    const cVal = c?.v;
    if (aVal != null || bVal != null) {
      const aStr = aVal != null ? String(aVal).slice(0, 60) : '';
      const bStr = bVal != null ? String(bVal).slice(0, 60) : '';
      const cStr = cVal != null ? String(cVal).slice(0, 20) : '';
      console.log(`  row ${r + 1}: A="${aStr}" B="${bStr}" C="${cStr}"`);
    }
  }
}
