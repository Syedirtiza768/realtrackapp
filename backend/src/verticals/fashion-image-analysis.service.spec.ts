import { FashionImageAnalysisService } from './fashion-image-analysis.service.js';

describe('FashionImageAnalysisService', () => {
  const openai = { chat: jest.fn() };
  const storage = {
    buildDurableKey: jest.fn((key: string) => key),
    putObject: jest.fn(),
    queueVariantGeneration: jest.fn(),
    getCdnUrl: jest.fn((key: string) => `https://cdn.example/${key}`),
    keyFromUrl: jest.fn(() => 'fashion/intake/org/photo.webp'),
    generateDownloadUrl: jest.fn(async (key: string) => `https://signed.example/${key}`),
  };
  const imageProcessor = {
    convertBufferToWebp: jest.fn(async (buffer: Buffer) => ({ buffer, width: 100, height: 100 })),
  };
  const taxonomy = {
    getDefaultCategoryTreeId: jest.fn(async () => '0'),
    getCategorySuggestions: jest.fn(async () => [
      { category: { categoryId: '15724', categoryName: "Women's Tops" } },
    ]),
  };
  const modelRouter = {
    selectVisionRoute: jest.fn(() => ({
      lane: 'flagship',
      model: 'openai/gpt-4.1-mini',
      policyVersion: 1,
      segmentKey: 'fashion',
    })),
    assertAllowed: jest.fn(),
  };
  const service = new FashionImageAnalysisService(
    { get: jest.fn(() => undefined) } as never,
    { resolveOrganizationId: jest.fn(async () => ({ organizationId: 'org-1' })) } as never,
    storage as never,
    imageProcessor as never,
    openai as never,
    { logRun: jest.fn(async () => undefined) } as never,
    modelRouter as never,
    taxonomy as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    storage.generateDownloadUrl.mockResolvedValue('https://signed.example/photo.webp');
    taxonomy.getCategorySuggestions.mockResolvedValue([
      { category: { categoryId: '15724', categoryName: "Women's Tops" } },
    ]);
  });

  it('analyzes the complete photo set and keeps confirmed user edits', async () => {
    openai.chat.mockResolvedValue({
      content: {
        itemType: 'Linen shirt',
        categoryFamily: 'clothing',
        categorySearchQuery: "women's linen shirt",
        brand: 'Guessed Brand',
        color: 'White',
        size: 'M',
        department: 'Women',
        multipleDifferentItems: false,
        warnings: [],
      },
      model: 'openai/gpt-4.1-mini',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      estimatedCostUsd: 0,
      latencyMs: 12,
    });

    const result = await service.analyze(
      { id: 'user-1' } as never,
      {
        imageUrls: [
          'https://cdn.example/front.webp',
          'https://cdn.example/label.webp',
        ],
        currentAttributes: { brand: 'Confirmed Label Brand' },
        confirmedKeys: ['brand'],
        currentBrand: 'Confirmed Label Brand',
      },
    );

    expect(openai.chat).toHaveBeenCalledTimes(1);
    expect(openai.chat.mock.calls[0][0].imageUrls).toHaveLength(2);
    expect(result.status).toBe('suggested');
    expect(result.attributes.brand).toBe('Confirmed Label Brand');
    expect(result.attributes.itemType).toBe('Linen shirt');
    expect(result.attributes.color).toBe('White');
    expect(result.attributes._confirmedKeys).toEqual(expect.arrayContaining(['brand']));
    expect(result.attributes._suggestedKeys).toEqual(expect.arrayContaining(['itemType', 'color']));
    expect(result.category.categoryId).toBe('15724');
    expect(result.conflicts.some((item) => item.key === 'brand')).toBe(true);
  });

  it('preserves photos and entered values when analysis fails', async () => {
    openai.chat.mockRejectedValue(new Error('vision unavailable'));
    const result = await service.analyze(
      { id: 'user-1' } as never,
      {
        imageUrls: ['https://cdn.example/front.webp'],
        currentAttributes: { department: 'Women' },
        currentTitle: 'Manual linen shirt',
        currentBrand: 'Label Brand',
      },
    );
    expect(result.status).toBe('failed');
    expect(result.attributes.department).toBe('Women');
    expect(result.title).toBe('Manual linen shirt');
    expect(result.warnings.join(' ')).toMatch(/continue manually/i);
  });

  it('flags a photo set that appears to contain multiple garments', async () => {
    openai.chat.mockResolvedValue({
      content: {
        itemType: 'Mixed garments',
        categoryFamily: 'clothing',
        multipleDifferentItems: true,
        reviewPhotoSet: true,
        warnings: [],
      },
      model: 'openai/gpt-4.1-mini',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      estimatedCostUsd: 0,
      latencyMs: 8,
    });
    const result = await service.analyze(
      { id: 'user-1' } as never,
      { imageUrls: ['https://cdn.example/a.webp', 'https://cdn.example/b.webp'] },
    );
    expect(result.multipleItems).toBe(true);
    expect(result.reviewPhotoSet).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/more than one/i);
  });

  it('does not silently convert missing measurements into invented values', async () => {
    openai.chat.mockResolvedValue({
      content: {
        itemType: 'Jacket',
        categoryFamily: 'clothing',
        chestMeasurement: null,
        measurementsUnit: null,
      },
      model: 'openai/gpt-4.1-mini',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      estimatedCostUsd: 0,
      latencyMs: 5,
    });
    const result = await service.analyze(
      { id: 'user-1' } as never,
      { imageUrls: ['https://cdn.example/jacket.webp'] },
    );
    expect(result.attributes.chestMeasurement).toBeUndefined();
  });
});
