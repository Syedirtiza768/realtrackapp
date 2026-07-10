const BASE = 'https://mhn.realtrackapp.com/api';
const JOB_ID = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272';
const DELAY = 1200; // ms between requests (well under 100/min medium limit)

const USED_RE = /\b(used|refurbished|salvage|for.parts|not.working)\b/i;
const USED_IDS = new Set(['3000','4000','5000','6000','7000','2000','2500']);
const USED_ENUM_RE = /^(USED_|FOR_PARTS|SELLER_REFURB|MANUFACTURER_REFURB|CERTIFIED_REFURB)/i;

function isUsed(c) {
  if (!c) return false;
  const lc = String(c).toLowerCase().trim();
  if (USED_RE.test(lc)) return true;
  const num = lc.replace(/-.*/, '').trim();
  if (USED_IDS.has(num)) return true;
  if (USED_ENUM_RE.test(c)) return true;
  return false;
}

function stripNew(title) {
  return title.replace(/\bNew\b\s*/gi, '').replace(/\s{2,}/g, ' ').trim();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, opts, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, opts);
    if (res.status === 429) {
      const wait = DELAY * (i + 2);
      console.log(`  429 rate limited, waiting ${(wait/1000).toFixed(1)}s...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      if (i < retries - 1) { await sleep(DELAY * 2); continue; }
      throw new Error(`${res.status}: ${text}`);
    }
    return res;
  }
  throw new Error('Max retries exceeded');
}

async function main() {
  console.log('Logging in...');
  const loginRes = await fetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@realtrack.local', password: 'ChangeMe123!' }),
  });
  const { accessToken } = await loginRes.json();
  console.log('Authenticated.\n');

  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  // Fetch all products page by page
  let page = 1, total = 0;
  const all = [];
  while (true) {
    const res = await fetchWithRetry(`${BASE}/catalog-products?pipelineJobId=${JOB_ID}&page=${page}&limit=100`, { headers: H });
    const data = await res.json();
    const items = data.data || data.items || data.products || data;
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    total += items.length;
    if (page % 20 === 0) console.log(`  ... ${total} fetched`);
    if (items.length < 100) break;
    page++;
    await sleep(DELAY);
  }
  console.log(`Fetched ${all.length} products.\n`);

  // Filter
  const bad = all.filter(p => {
    if (!/\bNew\b/i.test(p.title || '')) return false;
    return isUsed(p.conditionId || p.conditionLabel || '');
  });
  console.log(`Mismatched: ${bad.length}\n`);
  if (!bad.length) { console.log('Nothing to fix.'); return; }

  // Preview
  for (const p of bad.slice(0, 8)) {
    console.log(`  "${p.title}" -> "${stripNew(p.title)}"  [${p.conditionId}]`);
  }
  if (bad.length > 8) console.log(`  ... +${bad.length - 8}\n`);

  // Fix one by one with delays
  let ok = 0, fail = 0;
  for (let i = 0; i < bad.length; i++) {
    const p = bad[i];
    const newTitle = stripNew(p.title);
    if (newTitle === p.title) continue;
    try {
      const res = await fetchWithRetry(`${BASE}/catalog-products/${p.id}`, {
        method: 'PATCH', headers: H, body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) ok++;
      else { console.error(`  FAIL ${p.sku}: ${res.status}`); fail++; }
    } catch (e) { console.error(`  FAIL ${p.sku}: ${e.message}`); fail++; }
    if ((i + 1) % 50 === 0) console.log(`  Progress: ${i + 1}/${bad.length} (ok=${ok} fail=${fail})`);
    await sleep(DELAY);
  }

  console.log(`\nDone. Fixed: ${ok}, Failed: ${fail}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
