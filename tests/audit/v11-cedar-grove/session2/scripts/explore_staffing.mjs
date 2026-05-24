// Inspect STAFFING tab for FTE columns + R85 SUM formula bug
import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve('docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx');
const wb = XLSX.readFile(file, { cellFormula: true });
const ws = wb.Sheets['STAFFING'];

const range = XLSX.utils.decode_range(ws['!ref']);
console.log(`STAFFING range: ${ws['!ref']}`);

// Look for column header row for "Year 1" or "2028" near row 49-51
for (let r = 48; r < 55; r++) {
  const cells = [];
  for (let c = 0; c < 20; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell?.v != null && cell.v !== '') {
      cells.push(`${XLSX.utils.encode_col(c)}=${String(cell.v).slice(0, 25)}`);
    }
  }
  console.log(`r${r + 1}: ${cells.join(' | ')}`);
}

// FTE rows are r52-r83 per analysis. Inspect E-J for each.
console.log('\n--- Position FTE rows (r52-r83) — columns E through J ---');
for (let r = 51; r < 84; r++) {
  const b = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
  const cells = [];
  for (let c = 4; c <= 9; c++) {  // E-J
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell?.v != null) {
      const v = typeof cell.v === 'number' ? cell.v : String(cell.v).slice(0, 12);
      cells.push(`${XLSX.utils.encode_col(c)}=${v}`);
    }
  }
  console.log(`r${r + 1}: B="${String(b ?? '').slice(0, 25)}" | ${cells.join(' | ')}`);
}

console.log('\n--- r84-r90 (total + nearby) ---');
for (let r = 83; r < 92; r++) {
  for (let c = 0; c <= 12; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell?.v != null || cell?.f) {
      const v = cell.v != null ? (typeof cell.v === 'number' ? cell.v : String(cell.v).slice(0, 30)) : '(formula-no-value)';
      const f = cell.f ? ` [f=${cell.f}]` : '';
      console.log(`  ${XLSX.utils.encode_cell({ r, c })}: v=${v}${f}`);
    }
  }
}
