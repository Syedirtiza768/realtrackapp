import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const inputFile = path.join(ROOT, 'docs', '2008 Mercedes C350 AMG.xlsx');

const wb = XLSX.readFile(inputFile);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const headers = rows[1].map((h) => String(h).trim());
const col = (name) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

const cPN = col('Part Number');
const cPrice = col('Price');
const cQty = col('Quantity');
const cMake = col('Vehicle Make');
const cDesc = col('Description');
const cImg = col('Image URLs');
const cSku = col('SKU');

const parts = [];
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r.some((c) => c !== '' && c != null)) continue;
  parts.push({
    pn: String(r[cPN] ?? '').trim(),
    price: r[cPrice],
    qty: r[cQty],
    make: String(r[cMake] ?? '').trim(),
    desc: String(r[cDesc] ?? '').trim(),
    sku: String(r[cSku] ?? '').trim(),
    img: String(r[cImg] ?? '').trim(),
  });
}

console.log('Total data rows:', parts.length);
console.log('Vehicle master row desc:', parts[0]?.desc);
console.log('\n--- Distinct SKUs ---');
console.log([...new Set(parts.map((p) => p.sku))].join('\n'));

const prices = parts.slice(1).map((p) => Number(p.price)).filter((n) => Number.isFinite(n));
console.log('\nPrice range (parts):', Math.min(...prices), '-', Math.max(...prices), 'count=', prices.length);

console.log('\n--- All part descriptions (full) ---');
parts.forEach((p, i) => {
  console.log(`${i}\t[${p.pn}]\t$${p.price}\tq${p.qty}\t${p.desc}`);
});

// distinct image URL prefixes
console.log('\n--- Sample image URL ---');
console.log(parts[3]?.img);
