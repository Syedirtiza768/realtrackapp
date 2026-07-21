import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../openai.service.js';
import { TITLE_POSITION_PART_NAME_PROMPT } from '../prompts/title-position-part-name.prompt.js';

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';

export interface TitlePositionPartNameItem {
  id: string;
  rawDesc?: string | null;
  partNumber?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | null;
  categoryName?: string | null;
  fallbackPosition?: string | null;
  fallbackPartName?: string | null;
}

export interface TitlePositionPartNameResult {
  id: string;
  position: string;
  partName: string;
  source: 'gemini' | 'fallback';
}

/**
 * Batch-resolve Position + Part Name title slots via Gemini 3.1 Flash Lite
 * (OpenRouter). Used by enterprise listing optimization for US/AU titles.
 */
@Injectable()
export class TitlePositionPartNamePipeline {
  private readonly logger = new Logger(TitlePositionPartNamePipeline.name);

  constructor(private readonly openai: OpenAiService) {}

  async resolveBatch(
    items: TitlePositionPartNameItem[],
  ): Promise<Map<string, TitlePositionPartNameResult>> {
    const results = new Map<string, TitlePositionPartNameResult>();
    for (const item of items) {
      results.set(item.id, {
        id: item.id,
        position: String(item.fallbackPosition ?? '').trim(),
        partName: String(item.fallbackPartName ?? '').trim(),
        source: 'fallback',
      });
    }
    if (items.length === 0) return results;

    const model =
      process.env.TITLE_POSITION_PART_NAME_MODEL ||
      process.env.PIPELINE_TITLE_SLOT_MODEL ||
      DEFAULT_MODEL;
    const batchSize = Math.max(
      1,
      Number(process.env.TITLE_POSITION_PART_NAME_BATCH_SIZE ?? '25') || 25,
    );
    const concurrency = Math.max(
      1,
      Number(process.env.TITLE_POSITION_PART_NAME_CONCURRENCY ?? '5') || 5,
    );

    const chunks: TitlePositionPartNameItem[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      chunks.push(items.slice(i, i + batchSize));
    }

    this.logger.log(
      `Title position/partName: ${items.length} items, ${chunks.length} batches, model=${model}`,
    );

    await this.mapWithConcurrency(chunks, concurrency, async (chunk) => {
      try {
        const payload = chunk.map((item) => ({
          id: item.id,
          description: String(item.rawDesc ?? '').slice(0, 500),
          partNumber: item.partNumber ?? '',
          make: item.make ?? '',
          model: item.model ?? '',
          year: item.year ?? '',
          categoryName: item.categoryName ?? '',
          hintPosition: item.fallbackPosition ?? '',
          hintPartName: item.fallbackPartName ?? '',
        }));

        const response = await this.openai.chat({
          systemPrompt: TITLE_POSITION_PART_NAME_PROMPT.systemPrompt,
          userPrompt: `Extract position and partName for these ${payload.length} items:\n\n${JSON.stringify(payload)}\n\n${TITLE_POSITION_PART_NAME_PROMPT.userPrompt}`,
          jsonMode: true,
          temperature: TITLE_POSITION_PART_NAME_PROMPT.temperature,
          maxTokens: TITLE_POSITION_PART_NAME_PROMPT.maxTokens,
          model,
          costLane: 'title-position-part-name',
        });

        const parsed = response.content as
          | { results?: Array<Record<string, unknown>> }
          | undefined;
        for (const row of parsed?.results ?? []) {
          if (!row || typeof row.id !== 'string') continue;
          const existing = results.get(row.id);
          if (!existing) continue;
          const position = this.sanitizeSlot(row.position, 28);
          const partName = this.sanitizeSlot(row.partName, 48);
          results.set(row.id, {
            id: row.id,
            position: position || existing.position,
            partName: partName || existing.partName,
            source: position || partName ? 'gemini' : existing.source,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Title position/partName batch of ${chunk.length} failed: ${String(err)} — using fallbacks`,
        );
      }
    });

    return results;
  }

  private sanitizeSlot(value: unknown, maxLen: number): string {
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

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (next < items.length) {
          const i = next++;
          results[i] = await fn(items[i]);
        }
      },
    );
    await Promise.all(workers);
    return results;
  }
}
