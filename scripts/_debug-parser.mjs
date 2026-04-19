import { readFileSync } from 'fs';

function parseCsvRecords(csvText) {
  const records = [];
  let currentField = '';
  let currentRecord = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') { currentField += '"'; i++; }
        else { inQuotes = false; }
      } else { currentField += ch; }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { currentRecord.push(currentField); currentField = ''; continue; }
    if (ch === '\r') {
      if (next === '\n') i++;
      currentRecord.push(currentField); records.push(currentRecord);
      currentField = ''; currentRecord = []; continue;
    }
    if (ch === '\n') {
      currentRecord.push(currentField); records.push(currentRecord);
      currentField = ''; currentRecord = []; continue;
    }
    currentField += ch;
  }
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField); records.push(currentRecord);
  }
  return records.filter(r => r.some(f => f.trim() !== ''));
}

function normalizeHeaderKey(h) {
  return h.replace(/\(.*?\)/g, '').replace(/^\*/, '').replace(/^C:/i, '').trim().toLowerCase();
}
function buildColMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => { const key = normalizeHeaderKey(h); if (key) map[key] = i; });
  return map;
}
function col(fields, map, ...names) {
  for (const name of names) {
    const idx = map[name.toLowerCase()];
    if (idx !== undefined && fields[idx] !== undefined) return fields[idx].trim();
  }
  return '';
}

const csv = readFileSync('output/inventory-export-selected-96-2026-04-06.csv', 'utf8');
const records = parseCsvRecords(csv);
console.log('Total records:', records.length);
console.log('Record 0 length:', records[0]?.length, '| first cell:', records[0]?.[0]);
console.log('Record 1 length:', records[1]?.length, '| first cell:', records[1]?.[0]);
console.log('Record 2 length:', records[2]?.length, '| action:', records[2]?.[0], '| rel:', records[2]?.[4]);

const firstCell = records[0][0]?.trim().toLowerCase() ?? '';
const hasInfoRow = firstCell === 'info' || firstCell.startsWith('info,');
const headerRowIndex = hasInfoRow ? 1 : 0;
const dataStartIndex = headerRowIndex + 1;
console.log('hasInfoRow:', hasInfoRow, '| dataStartIndex:', dataStartIndex);

const rawHeaders = records[headerRowIndex].map(h => h.trim());
const colMap = buildColMap(rawHeaders);
console.log('Headers count:', rawHeaders.length);
console.log('colMap action idx:', colMap['action'], '| title idx:', colMap['title'], '| startprice idx:', colMap['startprice']);

let addCount = 0, compatCount = 0, emptyCount = 0, otherCount = 0, missingTitle = 0, missingPrice = 0;
for (let i = dataStartIndex; i < records.length; i++) {
  const fields = records[i];
  const action = col(fields, colMap, 'action').toLowerCase();
  const rel = col(fields, colMap, 'relationship');
  if (rel === 'Compatibility') { compatCount++; continue; }
  if (action && action !== 'info') {
    addCount++;
    const title = col(fields, colMap, 'title');
    const price = col(fields, colMap, 'startprice', 'price', 'buynow price');
    if (!title.trim()) missingTitle++;
    if (!price.trim()) missingPrice++;
    if (i <= dataStartIndex + 2) {
      console.log(`Row ${i}: action="${action}" title="${title.slice(0,40)}" price="${price}" rel="${rel}"`);
    }
  } else if (!action) {
    emptyCount++;
    if (i <= dataStartIndex + 10) console.log(`Row ${i} empty action: rel="${rel}" fields[0]="${fields[0]}" fields[4]="${fields[4]}"`);
  } else {
    otherCount++;
    console.log(`Row ${i} OTHER: action="${action}"`);
  }
}
console.log(`\nAdd: ${addCount} | Compat: ${compatCount} | EmptyAction: ${emptyCount} | Other: ${otherCount}`);
console.log(`Missing title: ${missingTitle} | Missing price: ${missingPrice}`);
