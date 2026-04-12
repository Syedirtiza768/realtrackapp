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
const row = parseCSVLine(lines[3]);
fs.writeFileSync('d:\\apps\\listingpro\\scripts\\_desc-template.html', row[10]);
console.log('Description length:', row[10].length);
console.log('Written to _desc-template.html');
