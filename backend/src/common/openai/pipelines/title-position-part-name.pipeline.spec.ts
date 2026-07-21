import { TitlePositionPartNamePipeline } from './title-position-part-name.pipeline.js';
import type { OpenAiService } from '../openai.service.js';

describe('TitlePositionPartNamePipeline', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns heuristic fallbacks when the model returns nothing useful', async () => {
    const openAi = {
      chat: jest.fn().mockResolvedValue({
        content: { results: [] },
        estimatedCostUsd: 0,
      }),
    };
    const pipeline = new TitlePositionPartNamePipeline(
      openAi as unknown as OpenAiService,
    );

    const map = await pipeline.resolveBatch([
      {
        id: 'a',
        rawDesc: 'Front Left Fog Light assembly',
        fallbackPosition: 'Front Left',
        fallbackPartName: 'Fog Light',
      },
    ]);

    expect(map.get('a')).toEqual({
      id: 'a',
      position: 'Front Left',
      partName: 'Fog Light',
      source: 'fallback',
    });
  });

  it('applies Gemini results over fallbacks when present', async () => {
    process.env.TITLE_POSITION_PART_NAME_BATCH_SIZE = '10';
    process.env.TITLE_POSITION_PART_NAME_CONCURRENCY = '1';
    const openAi = {
      chat: jest.fn().mockResolvedValue({
        content: {
          results: [
            {
              id: 'a',
              position: 'Rear Right',
              partName: 'Tail Light',
            },
          ],
        },
        estimatedCostUsd: 0.0001,
      }),
    };
    const pipeline = new TitlePositionPartNamePipeline(
      openAi as unknown as OpenAiService,
    );

    const map = await pipeline.resolveBatch([
      {
        id: 'a',
        rawDesc: 'RH rear lamp',
        fallbackPosition: 'Right',
        fallbackPartName: 'Lamp',
      },
    ]);

    expect(map.get('a')).toEqual({
      id: 'a',
      position: 'Rear Right',
      partName: 'Tail Light',
      source: 'gemini',
    });
    expect(openAi.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-3.1-flash-lite',
        costLane: 'title-position-part-name',
        jsonMode: true,
      }),
    );
  });

  it('keeps fallbacks when a batch call throws', async () => {
    const openAi = {
      chat: jest.fn().mockRejectedValue(new Error('upstream timeout')),
    };
    const pipeline = new TitlePositionPartNamePipeline(
      openAi as unknown as OpenAiService,
    );

    const map = await pipeline.resolveBatch([
      {
        id: 'b',
        fallbackPosition: 'Front',
        fallbackPartName: 'Grille',
      },
    ]);

    expect(map.get('b')?.source).toBe('fallback');
    expect(map.get('b')?.partName).toBe('Grille');
  });
});
