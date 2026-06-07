import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', '..', 'docs', 'model-comparison', 'raw');

const OK = ['openai_gpt-4.1-mini','google_gemini-2.5-flash','deepseek_deepseek-chat-v3-0324','minimax_minimax-m3','meta-llama_llama-3.3-70b-instruct','openai_gpt-4o-mini'];

const out = {};
for (const slug of OK) {
  const f = path.join(RAW, slug + '.json');
  if (!fs.existsSync(f)) continue;
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!r.items) continue;
  out[slug] = r.items.map((it) => ({
    idx: it.index,
    title: it.title,
    titleLen: (it.title || '').length,
    brand: it.brand,
    type: it.type,
    mpn: it.mpn,
    oem: it.oemNumber,
    placement: it.placement,
    material: it.material,
    color: it.color,
    warranty: it.warranty,
    fitmentType: it.fitmentType,
    interchange: it.interchangeNumber,
    fitmentRows: (it.compatibility || []).length,
    fitmentMakes: [...new Set((it.compatibility || []).map((c) => c.make))],
    fitmentModels: [...new Set((it.compatibility || []).map((c) => c.model))].slice(0, 10),
    yearsSpan: (() => { const ys = (it.compatibility || []).map((c) => Number(c.year)).filter(Boolean); return ys.length ? `${Math.min(...ys)}-${Math.max(...ys)}` : ''; })(),
    techNotes: it.technicalNotes,
    descLen: (it.description || '').length,
    descSnippet: (it.description || '').slice(0, 220),
  }));
}
fs.writeFileSync(path.join(RAW, '..', 'qualitative.json'), JSON.stringify(out, null, 2));

// Print engine (idx0) + door regulator (idx1) titles for each
console.log('=== ENGINE (idx 0) titles ===');
for (const slug of OK) { const m = out[slug]; if (m) console.log(`${slug.padEnd(38)} [${m[0]?.titleLen}] ${m[0]?.title}`); }
console.log('\n=== DOOR WINDOW REGULATOR (idx 1) titles ===');
for (const slug of OK) { const m = out[slug]; if (m) console.log(`${slug.padEnd(38)} [${m[1]?.titleLen}] ${m[1]?.title}`); }
console.log('\n=== Fitment makes per model (engine) ===');
for (const slug of OK) { const m = out[slug]; if (m) console.log(`${slug.padEnd(38)} rows=${m[0]?.fitmentRows} makes=${JSON.stringify(m[0]?.fitmentMakes)} span=${m[0]?.yearsSpan}`); }
console.log('\n=== MPN fidelity (engine, provided=272.970) + (regulator, provided=A 204 720 06 79) ===');
for (const slug of OK) { const m = out[slug]; if (m) console.log(`${slug.padEnd(38)} engMPN=${m[0]?.mpn}  regMPN=${m[1]?.mpn}  regOEM=${m[1]?.oem}`); }
console.log('\nWrote qualitative.json');
