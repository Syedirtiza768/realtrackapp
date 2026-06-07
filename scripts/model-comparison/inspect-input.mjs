import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const inputFile = path.join(ROOT, 'docs', '2008 Mercedes C350 AMG.xlsx');

const wb = XLSX.readFile(inputFile);
console.log('SHEETS:', JSON.stringify(wb.SheetNames));

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('\n========================================');
  console.log(`SHEET: "${name}"  rows=${rows.length}`);
  console.log('========================================');
  const preview = rows.slice(0, Math.min(rows.length, 14));
  preview.forEach((r, i) => {
    const cells = r.map((c) => String(c).replace(/\s+/g, ' ').slice(0, 40));
    console.log(`[${i}] ${JSON.stringify(cells)}`);
  });
  if (rows.length > 14) console.log(`... (${rows.length - 14} more rows)`);
}
