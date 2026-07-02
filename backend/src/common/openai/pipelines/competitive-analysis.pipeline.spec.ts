import type { OpenAiService } from '../openai.service.js';
import { CompetitiveAnalysisPipeline } from './competitive-analysis.pipeline.js';

/* ── Helpers ── */

function mockOpenAi(response: Record<string, unknown> = {}) {
  return {
    chat: jest.fn().mockResolvedValue({
      content: {
        marketSummary: {
          totalListings: 15,
          avgPrice: 42.5,
          medianPrice: 40,
          minPrice: 25,
          maxPrice: 65,
          priceStdDev: 8.5,
        },
        conditionBreakdown: {
          'New': { count: 5, avgPrice: 55 },
          'Used': { count: 10, avgPrice: 35 },
        },
        recommendedPricing: {
          competitive: 38,
          premium: 52,
          aggressive: 28,
          rationale: 'Market supports competitive pricing at $38',
        },
        marketInsights: ['High demand for OEM parts', 'Price war between top 3 sellers'],
        listingOptimizations: ['Add fitment details', 'Include OEM part number'],
        confidence: 0.82,
        ...response,
      },
      estimatedCostUsd: 0.003,
    }),
  };
}

/* ── Tests ── */

describe('CompetitiveAnalysisPipeline', () => {
  let svc: CompetitiveAnalysisPipeline;
  let openai: ReturnType<typeof mockOpenAi>;

  beforeEach(() => {
    openai = mockOpenAi();
    svc = new CompetitiveAnalysisPipeline(openai as unknown as OpenAiService);
  });

  it('parses marketSummary from AI response', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.marketSummary.totalListings).toBe(15);
    expect(result.marketSummary.avgPrice).toBe(42.5);
    expect(result.marketSummary.medianPrice).toBe(40);
  });

  it('parses conditionBreakdown', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.conditionBreakdown['New']).toEqual({ count: 5, avgPrice: 55 });
    expect(result.conditionBreakdown['Used']).toEqual({ count: 10, avgPrice: 35 });
  });

  it('parses recommendedPricing at 3 tiers', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.recommendedPricing.competitive).toBe(38);
    expect(result.recommendedPricing.premium).toBe(52);
    expect(result.recommendedPricing.aggressive).toBe(28);
    expect(result.recommendedPricing.rationale).toContain('Market supports');
  });

  it('returns confidence score', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.confidence).toBe(0.82);
  });

  it('returns marketInsights array', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.marketInsights).toHaveLength(2);
    expect(result.marketInsights[0]).toContain('High demand');
  });

  it('returns listingOptimizations array', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.listingOptimizations).toHaveLength(2);
  });

  it('returns rawResponse for auditing', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.rawResponse).toBeDefined();
    expect(result.rawResponse.estimatedCostUsd).toBe(0.003);
  });

  it('handles missing fields in AI response', async () => {
    openai.chat.mockResolvedValue({
      content: {}, // empty response
      estimatedCostUsd: 0.001,
    });

    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result.marketSummary.totalListings).toBe(0);
    expect(result.marketSummary.avgPrice).toBeNull();
    expect(result.conditionBreakdown).toEqual({});
    expect(result.recommendedPricing.competitive).toBeNull();
    expect(result.marketInsights).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('handles empty competitorData', async () => {
    const result = await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', []);
    expect(result).toBeDefined();
    expect(openai.chat).toHaveBeenCalled();
  });

  it('passes competitorData formatted as JSON in prompt', async () => {
    const competitorData = [{ title: 'Part A', price: 30 }];
    await svc.analyze('TRW Brake Pad', 'BP-123', 'Used', competitorData);
    const call = openai.chat.mock.calls[0][0];
    expect(call.userPrompt).toContain('Part A');
  });
});
