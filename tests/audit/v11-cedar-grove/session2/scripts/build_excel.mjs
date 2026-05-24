// Phase 5.2 — Build Cedar_Grove_Reconciliation.xlsx
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const v11 = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/v11_values.json', 'utf8'));
const sl = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/sl_values.json', 'utf8'));
const cls = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/classifications.json', 'utf8'));
const slFpf = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/sl_fpf.json', 'utf8'));
const v11Fpf = JSON.parse(fs.readFileSync('tests/audit/v11-cedar-grove/session2/v11_fpf.json', 'utf8'));

// Helper: build a row per line.
// We want columns: A=Line, then per-year (Y11 V11, SL, Δ$, Δ%), Class, Sub, Rationale, BACKLOG, Note
const headers = [
  'Line',
  'Y1 V11', 'Y1 SL', 'Y1 Δ$', 'Y1 Δ%',
  'Y2 V11', 'Y2 SL', 'Y2 Δ$', 'Y2 Δ%',
  'Y3 V11', 'Y3 SL', 'Y3 Δ$', 'Y3 Δ%',
  'Y4 V11', 'Y4 SL', 'Y4 Δ$', 'Y4 Δ%',
  'Y5 V11', 'Y5 SL', 'Y5 Δ$', 'Y5 Δ%',
  'Classification', 'Sub', 'Rationale', 'BACKLOG ref', 'Note',
];

// Group lines by section so we can insert section headers
const sectionMap = {
  'REVENUE': (line) => line.startsWith('Revenue ·'),
  'EXPENSES': (line) => line.startsWith('Expenses ·'),
  'STAFFING': (line) => line.startsWith('Staffing ·'),
  'BOTTOM LINE': (line) => line.startsWith('Bottom line ·'),
};

const aoa = [headers];

// Order matters — group by section, lines in classification order within
const allLines = Object.keys(cls.by_line);
for (const [sectionName, predicate] of Object.entries(sectionMap)) {
  const sectionLines = allLines.filter(predicate);
  if (sectionLines.length === 0) continue;
  aoa.push([sectionName, ...Array(headers.length - 1).fill('')]);
  for (const lineLabel of sectionLines) {
    const entries = cls.by_line[lineLabel];
    // Pull per-year entries (sorted by year ascending)
    const byYear = {};
    for (const e of entries) byYear[e.year] = e;
    const first = entries[0];
    const row = [lineLabel];
    for (let y = 1; y <= 5; y++) {
      const e = byYear[y];
      row.push(e?.v11_value ?? '', e?.sl_value ?? '', e?.delta_dollars ?? '', e?.delta_pct ?? '');
    }
    row.push(first?.classification ?? '', first?.sub_category ?? '', first?.rationale ?? '', first?.backlog_ref ?? '', first?.impact_note ?? first?.note_for_v11_comparison ?? '');
    aoa.push(row);
  }
}

// FPF section
aoa.push(['FPF SCORECARD (recomputed via identical thresholds)', ...Array(headers.length - 1).fill('')]);
const fpfRow = (name) => {
  const slM = slFpf.scorecard.measures.find((m) => m.name === name);
  const v11M = v11Fpf.scorecard.measures.find((m) => m.name === name);
  const r = [`FPF · ${name}`];
  for (let i = 0; i < 5; i++) {
    const v11v = v11M?.values[i];
    const slv = slM?.values[i];
    const dlt = (typeof v11v === 'number' && typeof slv === 'number') ? slv - v11v : '';
    const pct = (typeof v11v === 'number' && typeof slv === 'number' && v11v !== 0) ? Math.round((slv - v11v) / Math.abs(v11v) * 1000) / 10 : '';
    r.push(v11v ?? '', slv ?? '', dlt, pct);
  }
  const slStatuses = slM?.statuses.join(' / ') ?? '';
  const v11Statuses = v11M?.statuses.join(' / ') ?? '';
  r.push('FPF metric', '', `SL statuses Y1-Y5: ${slStatuses}. V11 statuses Y1-Y5: ${v11Statuses}.`, '', '');
  return r;
};
for (const m of slFpf.scorecard.measures) {
  aoa.push(fpfRow(m.name));
}
aoa.push(['FPF · Overall', ...Array(20).fill(''), 'FPF result', '', `SL: ${slFpf.scorecard.overallMessage}. V11: ${v11Fpf.scorecard.overallMessage}`, '', '']);

// V11 template defect section
aoa.push(['V11 TEMPLATE DEFECTS', ...Array(headers.length - 1).fill('')]);
for (const d of v11.v11_template_defects) {
  aoa.push([`V11 defect: ${d.cell}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Not-bug (D1)', 'D1', d.description, 'Communicate to ESWA/WSCSC for V12', `Formula as written: ${d.formula_as_written}; Expected: ${d.expected_formula}`]);
}

const ws = XLSX.utils.aoa_to_sheet(aoa);

// Freeze top row + line column
ws['!freeze'] = { xSplit: 1, ySplit: 1 };
ws['!cols'] = [
  { wch: 56 },
  ...Array(20).fill({ wch: 14 }),
  { wch: 28 }, { wch: 8 }, { wch: 70 }, { wch: 30 }, { wch: 40 },
];

// Bold section headers via a custom row marker (Excel will show plain text; styling is best-effort with .xlsx without xlsx-style).
// SheetJS community edition has limited styling — we'll keep the structural data clean.

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Reconciliation');

// Also add a second sheet: FPF detail
const fpfSheet = [
  ['FPF Measure', 'Stage1 target', 'Stage2 target', 'V11 Y1', 'V11 Y2', 'V11 Y3', 'V11 Y4', 'V11 Y5', 'SL Y1', 'SL Y2', 'SL Y3', 'SL Y4', 'SL Y5', 'V11 statuses', 'SL statuses'],
];
for (const m of slFpf.scorecard.measures) {
  const v11M = v11Fpf.scorecard.measures.find((x) => x.name === m.name);
  fpfSheet.push([
    m.name, m.stage1Target ?? '', m.stage2Target ?? '',
    ...(v11M?.values ?? Array(5).fill('')),
    ...(m.values ?? Array(5).fill('')),
    (v11M?.statuses ?? []).join(' / '),
    m.statuses.join(' / '),
  ]);
}
const fpfWs = XLSX.utils.aoa_to_sheet(fpfSheet);
fpfWs['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, ...Array(10).fill({ wch: 10 }), { wch: 40 }, { wch: 40 }];
XLSX.utils.book_append_sheet(wb, fpfWs, 'FPF Detail');

// Sheet: Needs Decision items
const ndSheet = [['Line', 'Year', 'V11 value', 'SL value', 'Rationale', 'Status']];
for (const c of cls.classifications.filter((x) => x.classification === 'Needs decision')) {
  ndSheet.push([c.line, c.year, c.v11_value, c.sl_value, c.rationale, 'Open — see Recommendations']);
}
const ndWs = XLSX.utils.aoa_to_sheet(ndSheet);
ndWs['!cols'] = [{ wch: 50 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 100 }, { wch: 28 }];
XLSX.utils.book_append_sheet(wb, ndWs, 'Needs Decision');

const outPath = path.resolve('tests/audit/v11-cedar-grove/session2/Cedar_Grove_Reconciliation.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Wrote ${outPath}`);
console.log(`Reconciliation sheet rows: ${aoa.length}`);
console.log(`FPF Detail rows: ${fpfSheet.length}`);
console.log(`Needs Decision rows: ${ndSheet.length}`);
