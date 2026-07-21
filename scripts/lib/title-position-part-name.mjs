/**
 * Batch-resolve title Position + Part Name via Gemini 3.1 Flash Lite (OpenRouter).
 *
 * Year / Make / Model / OEM / "OEM Used" stay deterministic; only these two
 * title slots are AI-authored. Falls back to caller-supplied heuristics when
 * the API key is missing or a batch fails.
 */

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';

const SYSTEM_PROMPT = `You extract two short eBay Motors title segments from automotive part data.

For each item return:
- position: placement on the vehicle when known (e.g. "Front Left", "Rear", "Upper"). Empty string if unknown or not applicable (ECUs, filters, etc.).
- partName: concise buyer-facing part name only (e.g. "Fog Light", "Door Mirror Glass", "Brake Caliper"). No year, make, model, VIN, OEM number, or condition words (Used/OEM/New).

Rules:
- Factual only — do not invent a position that is not implied by the description.
- Title Case English. No ALL CAPS. No HTML.
- Keep partName short enough for an 80-char eBay title (typically 2-6 words).
- Return valid JSON only.`;

/**
 * @param {object} params
 * @param {Array<{ id: string, rawDesc?: string, partNumber?: string, make?: string, model?: string, year?: string, fallbackPosition?: string, fallbackPartName?: string }>} params.items
 * @param {import('openai').default | null} params.client
 * @param {object} [params.options]
 * @param {string} [params.options.model]
 * @param {number} [params.options.batchSize]
 * @param {number} [params.options.concurrency]
 * @param {(items: any[], concurrency: number, fn: Function) => Promise<any[]>} [params.options.mapWithConcurrency]
 * @returns {Promise<Map<string, { position: string, partName: string, source: 'gemini' | 'fallback' }>>}
 */
export async function resolvePositionPartNamesBatch({
  items,
  client,
  options = {},
}) {
  const results = new Map();
  for (const item of items) {
    results.set(item.id, {
      position: String(item.fallbackPosition ?? '').trim(),
      partName: String(item.fallbackPartName ?? '').trim(),
      source: 'fallback',
    });
  }

  if (!client || items.length === 0) return results;

  const model =
    options.model ||
    process.env.PIPELINE_TITLE_SLOT_MODEL ||
    process.env.TITLE_POSITION_PART_NAME_MODEL ||
    DEFAULT_MODEL;
  const batchSize = Math.max(
    1,
    Number(options.batchSize ?? process.env.PIPELINE_TITLE_SLOT_BATCH_SIZE ?? '25') ||
      25,
  );
  const concurrency = Math.max(
    1,
    Number(
      options.concurrency ?? process.env.PIPELINE_TITLE_SLOT_CONCURRENCY ?? '5',
    ) || 5,
  );
  const mapFn =
    options.mapWithConcurrency ||
    (async (chunks, conc, fn) => {
      const out = new Array(chunks.length);
      let idx = 0;
      async function worker() {
        while (idx < chunks.length) {
          const i = idx++;
          out[i] = await fn(chunks[i], i);
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(conc, chunks.length) }, () => worker()),
      );
      return out;
    });

  const chunks = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }

  await mapFn(chunks, concurrency, async (chunk) => {
    try {
      const payload = chunk.map((item) => ({
        id: item.id,
        description: String(item.rawDesc ?? '').slice(0, 500),
        partNumber: item.partNumber ?? '',
        make: item.make ?? '',
        model: item.model ?? '',
        year: item.year ?? '',
        hintPosition: item.fallbackPosition ?? '',
        hintPartName: item.fallbackPartName ?? '',
      }));

      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extract position and partName for each item. Return JSON:\n{"results":[{"id":"...","position":"...","partName":"..."}]}\n\nItems:\n${JSON.stringify(payload)}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: Math.min(4096, 80 * chunk.length + 200),
      });

      const raw = resp.choices?.[0]?.message?.content?.trim() || '';
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.results) ? parsed.results : [];
      for (const row of list) {
        if (!row || typeof row.id !== 'string') continue;
        const existing = results.get(row.id);
        if (!existing) continue;
        const position = sanitizeSlot(row.position, 28);
        const partName = sanitizeSlot(row.partName, 48);
        results.set(row.id, {
          position: position || existing.position,
          partName: partName || existing.partName,
          source:
            position || partName
              ? 'gemini'
              : existing.source,
        });
      }
    } catch (err) {
      console.log(
        `Gemini position/partName batch failed (${chunk.length} items): ${err instanceof Error ? err.message : String(err)} — using fallbacks`,
      );
    }
  });

  return results;
}

function sanitizeSlot(value, maxLen) {
  if (value == null) return '';
  let s = String(value)
    .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) {
    const cut = s.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    s = (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
  }
  return s;
}

export { DEFAULT_MODEL as TITLE_POSITION_PART_NAME_MODEL, SYSTEM_PROMPT };
