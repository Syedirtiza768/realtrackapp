import type { OpenAiService } from '../openai.service.js';
import { PricingAnalysisPipeline } from './pricing-analysis.pipeline.js';

/* ── Helpers ── */

function mockOpenAi(response: Record<string, unknown> = {}) {
  return {
    chat: jest.fn().mockResolvedValue({
      content: {
        suggestedPrice: 39.99,
        reasoning: 'Competitive pricing based on market data',
        marketPosition: 'average',
        confidence: 0.85,
        minViablePrice: 20,
        maxRecommendedPrice: 60,
        marginPercent: 30,
        competitorCount: 5,
        pricingStrategy: 'competitive',
        actionItems: ['Monitor competitor prices weekly'],
        ...response,
      },
      estimatedCostUsd: 0.002,
    }),
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    productTitle: 'TRW Brake Pad',
    partNumber: 'BP-123',
    brand: 'TRW',
    condition: 'Used',
    costPrice: 10,
    retailPrice: 50,
    mapPrice: 25,
    competitors: [
      {
        seller: 'SellerA',
        price: 35,
        condition: 'Used',
        title: 'TRW Brake Pad',
      },
      {
        seller: 'SellerB',
        price: 42,
        condition: 'New',
        title: 'TRW Brake Pad New',
      },
    ],
    marketSummary: {
      totalListings: 10,
      avgPrice: 38,
      medianPrice: 39,
      minPrice: 25,
      maxPrice: 55,
    },
    ...overrides,
  };
}

/* ── Tests ── */

describe('PricingAnalysisPipeline', () => {
  let svc: PricingAnalysisPipeline;
  let openai: ReturnType<typeof mockOpenAi>;

  beforeEach(() => {
    openai = mockOpenAi();
    svc = new PricingAnalysisPipeline(openai as unknown as OpenAiService);
  });

  it('returns pricing suggestion from OpenAI response', async () => {
    const result = await svc.suggestPrice(baseInput());

    expect(result.suggestedPrice).toBe(39.99);
    expect(result.pricingStrategy).toBe('match');
    expect(result.confidence).toBe(0.85);
    expect(result.reasoning).toContain('Competitive');
  });

  it('enforces MAP price floor', async () => {
    openai.chat.mockResolvedValue({
      content: {
        suggestedPrice: 15,
        confidence: 0.9,
        pricingStrategy: 'undercut',
      },
      estimatedCostUsd: 0.001,
    });

    const result = await svc.suggestPrice(baseInput({ mapPrice: 25 }));
    expect(result.suggestedPrice).toBe(25);
    expect(result.reasoning).toContain('MAP floor');
  });

  it('enforces cost price floor', async () => {
    openai.chat.mockResolvedValue({
      content: {
        suggestedPrice: 5,
        confidence: 0.9,
        pricingStrategy: 'undercut',
      },
      estimatedCostUsd: 0.001,
    });

    const result = await svc.suggestPrice(
      baseInput({ costPrice: 10, mapPrice: null }),
    );
    expect(result.suggestedPrice).toBe(10);
    expect(result.reasoning).toContain('cost floor');
  });

  it('validates marketPosition enum', async () => {
    openai.chat.mockResolvedValue({
      content: {
        suggestedPrice: 39,
        confidence: 0.8,
        marketPosition: 'invalid_value',
      },
      estimatedCostUsd: 0.001,
    });

    const result = await svc.suggestPrice(baseInput());
    expect(result.marketPosition).toBe('average'); // default fallback
  });

  it('validates pricingStrategy enum', async () => {
    openai.chat.mockResolvedValue({
      content: {
        suggestedPrice: 39,
        confidence: 0.8,
        pricingStrategy: 'unknown',
      },
      estimatedCostUsd: 0.001,
    });

    const result = await svc.suggestPrice(baseInput());
    expect(result.pricingStrategy).toBe('match'); // default fallback
  });

  it('handles NaN values from AI response', async () => {
    openai.chat.mockResolvedValue({
      content: {
        suggestedPrice: 'not-a-number',
        confidence: null,
        pricingStrategy: 'match',
      },
      estimatedCostUsd: 0.001,
    });

    const result = await svc.suggestPrice(baseInput());
    expect(result.suggestedPrice).toBe(50); // falls back to retailPrice
    expect(result.confidence).toBe(0);
  });

  it('handles missing competitors gracefully', async () => {
    openai.chat.mockResolvedValue({
      content: {
        suggestedPrice: 39,
        confidence: 0.8,
        pricingStrategy: 'match',
        competitorCount: 0,
      },
      estimatedCostUsd: 0.001,
    });

    const result = await svc.suggestPrice(baseInput({ competitors: [] }));
    expect(result.competitorCount).toBe(0);
  });

  it('returns rawResponse for auditing', async () => {
    const result = await svc.suggestPrice(baseInput());
    expect(result.rawResponse).toBeDefined();
    expect(result.rawResponse.estimatedCostUsd).toBe(0.002);
  });

  it('passes competitor data formatted in prompt', async () => {
    await svc.suggestPrice(baseInput());
    const call = openai.chat.mock.calls[0][0];
    expect(call.userPrompt).toContain('35.00');
    expect(call.userPrompt).toContain('SellerA');
  });

  it('returns actionItems array', async () => {
    const result = await svc.suggestPrice(baseInput());
    expect(Array.isArray(result.actionItems)).toBe(true);
  });
});
