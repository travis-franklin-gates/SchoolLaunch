import fs from 'node:fs';
const raw = fs.readFileSync('C:/Users/travisfr/.claude/projects/C--Users-travisfr-schoollaunch/56029da4-8dc2-4a92-9c02-950d8497aaa8/tool-results/mcp-supabase-execute_sql-1779551957996.txt', 'utf8');
const outer = JSON.parse(raw);
// outer.result is the string with untrusted-data markers around the JSON payload
const text = outer.result;
const startIdx = text.indexOf('\n[');
const endIdx = text.lastIndexOf(']\n');
if (startIdx < 0 || endIdx < 0) throw new Error('Could not locate array brackets');
const payload = text.substring(startIdx + 1, endIdx + 1);
const arr = JSON.parse(payload);
const positions = arr[0].positions;
fs.writeFileSync('tests/audit/v11-cedar-grove/session2/scripts/out/sl_positions.json', JSON.stringify(positions, null, 2));
console.log(`Wrote ${positions.length} positions`);
console.log(`Y1 FTE check: ${positions.filter(p => p.year === 1).reduce((s, p) => s + Number(p.fte), 0)}`);
