// Explore column headers / year labels for each key sheet
import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve('docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx');
const wb = XLSX.readFile(file, { cellFormula: true });

const sheetsToScan = ['INPUTS', 'STAFFING', 'P&L', 'DASHBOARD', 'REPORTS'];

for (const sheetName of sheetsToScan) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;
  console.log(`\n===== ${sheetName} — column scan around header rows =====`);
  const range = XLSX.utils.decode_range(ws['!ref']);
  // For each row in first 50, print all non-empty cells
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 50); r++) {
    const cells = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell?.v != null && cell.v !== '') {
        const v = typeof cell.v === 'number' ? cell.v.toString().slice(0, 12) : String(cell.v).slice(0, 25);
        cells.push(`${XLSX.utils.encode_col(c)}=${v}`);
      }
    }
    if (cells.length > 0) {
      console.log(`  r${r + 1}: ${cells.slice(0, 12).join(' | ')}`);
    }
  }
}
