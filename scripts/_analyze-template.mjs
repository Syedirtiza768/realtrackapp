import fs from 'fs';

const csv = fs.readFileSync('c:\\Users\\Irtiza Hassan\\Downloads\\inventory-export-selected-96-2026-04-06.csv', 'utf8');
const lines = csv.split('\n');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const headers = parseCSVLine(lines[1]);
console.log('Columns:', headers.length);

// Show 3 complete item rows
let itemCount = 0;
for (let i = 2; i < lines.length && itemCount < 3; i++) {
  if (!lines[i].trim()) continue;
  const row = parseCSVLine(lines[i]);
  if (row[4] && row[4].trim()) continue; // skip fitment rows
  itemCount++;
  console.log(`\n=== Item Row #${itemCount} (line ${i + 1}) ===`);
  headers.forEach((h, j) => {
    const val = row[j] || '';
    if (val.length > 200) {
      console.log(`  ${j}. ${h}: [${val.length} chars] ${val.substring(0, 120)}...`);
    } else {
      console.log(`  ${j}. ${h}: ${val}`);
    }
  });
}

// Show fitment row
for (let i = 2; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  if (row[4] && row[4].trim()) {
    console.log('\n=== Fitment Row Example ===');
    headers.forEach((h, j) => {
      if (row[j]) console.log(`  ${j}. ${h}: ${row[j]}`);
    });
    break;
  }
}
