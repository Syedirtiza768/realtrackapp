import XLSX from 'xlsx';

const files = [
  'Vins Report Status.xlsx',
  'eBay-parts-and-accs-listing-template-Mar-28-2026-19-33-14.xlsx',
  'eBay-category-listing-template-Mar-28-2026-19-39-50.xlsx',
  'eBay-category-listing-template-Mar-28-2026-19-43-18.xlsx',
];

for (const file of files) {
  try {
    const wb = XLSX.readFile(file);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FILE: ${file}`);
    console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log(`\n  Sheet: "${name}" (${data.length} rows)`);
      // For large sheets, just show row counts and first non-trivial row headers
      if (data.length > 100) {
        // Find first row with >3 cells
        for (let i = 0; i < Math.min(10, data.length); i++) {
          const row = data[i];
          if (row && row.filter(c => c != null && c !== '').length > 3) {
            const display = row.map(c => c == null ? '' : String(c).slice(0, 50));
            console.log(`    Header/Row ${i} (${row.length} cols): first 10 = ${JSON.stringify(display.slice(0, 10))}`);
            break;
          }
        }
        continue;
      }
      for (let i = 0; i < Math.min(6, data.length); i++) {
        const row = data[i];
        if (row && row.some(c => c != null && c !== '')) {
          const display = row.map(c => c == null ? '' : String(c).slice(0, 50));
          console.log(`    Row ${i} (${row.length} cols): ${JSON.stringify(display.slice(0, 15))}`);
        }
      }
    }
  } catch (e) {
    console.log(`\nFILE: ${file} -- ERROR: ${e.message}`);
  }
}
