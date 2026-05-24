// List sheet names + dimensions from the V11 Cedar Grove workbook.
import XLSX from 'xlsx';
import path from 'node:path';

const file = path.resolve('docs/v11-validation/V11_WA_Charter_Financial_Projection__Cedar_Grove__v3_LL_edits__AW_edits.xlsx');
const wb = XLSX.readFile(file, { cellFormula: true, cellNF: false, cellStyles: false });
console.log('SHEETS:');
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || '(empty)';
  console.log(`  - ${JSON.stringify(name)}: range=${ref}`);
}
