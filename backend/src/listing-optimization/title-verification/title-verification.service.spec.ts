import type { Repository } from 'typeorm';
import type { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import type { PipelineJob } from '../../ingestion/entities/pipeline-job.entity.js';
import type { OpenAiService } from '../../common/openai/openai.service.js';
import { TitleVerificationService } from './title-verification.service.js';

/* ── Helpers ── */

function mockProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'p1',
    title: '2018 Toyota Camry Brake Pad Set',
    partType: 'Brake Pad Set',
    mpn: 'BP-123',
    oemPartNumber: 'OEM-456',
    brand: 'Bosch',
    categoryName: 'Brakes',
    ...overrides,
  } as CatalogProduct;
}

describe('TitleVerificationService', () => {
  let svc: TitleVerificationService;
  let productRepo: { find: jest.Mock; query: jest.Mock };
  let jobRepo: { findOneBy: jest.Mock; update: jest.Mock };
  let openAi: { chat: jest.Mock };
  const originalEnv = { ...process.env };

  beforeEach(() => {
    productRepo = { find: jest.fn(), query: jest.fn().mockResolvedValue([]) };
    jobRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'job-1' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    openAi = { chat: jest.fn() };
    svc = new TitleVerificationService(
      productRepo as unknown as Repository<CatalogProduct>,
      jobRepo as unknown as Repository<PipelineJob>,
      openAi as unknown as OpenAiService,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws NotFoundException when the pipeline job does not exist', async () => {
    jobRepo.findOneBy.mockResolvedValue(null);
    await expect(svc.verifyJob('missing-job')).rejects.toThrow(
      /not found/i,
    );
  });

  it('flags a product whose title does not match its identified part', async () => {
    const p1 = mockProduct({ id: 'p1' });
    const p2 = mockProduct({
      id: 'p2',
      title: 'Front Bumper Cover',
      partType: 'Brake Pad Set',
    });
    const p3 = mockProduct({ id: 'p3' });
    productRepo.find.mockResolvedValue([p1, p2, p3]);
    openAi.chat.mockResolvedValue({
      content: {
        results: [
          { id: 'p1', match: true, confidence: 0.95, issue: null },
          {
            id: 'p2',
            match: false,
            confidence: 0.9,
            issue: 'Title says bumper cover but partType is Brake Pad Set',
          },
          { id: 'p3', match: true, confidence: 0.92, issue: null },
        ],
      },
      estimatedCostUsd: 0.0002,
    });

    const summary = await svc.verifyJob('job-1');

    expect(summary.status).toBe('completed');
    expect(summary.totalProducts).toBe(3);
    expect(summary.processedProducts).toBe(3);
    expect(summary.flaggedCount).toBe(1);
    expect(summary.unprocessedProductIds).toEqual([]);
    expect(summary.estimatedCostUsd).toBeCloseTo(0.0002);

    expect(productRepo.query).toHaveBeenCalledTimes(1);
    const [sql, params] = productRepo.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE catalog_products/);
    expect(params[0]).toBe('p2');
    const warnings = JSON.parse(params[1]);
    expect(warnings[0]).toMatchObject({
      code: 'TITLE_PART_MISMATCH',
      source: 'title-verification',
    });
  });

  it('leaves a product unprocessed when the model response omits its id', async () => {
    const p1 = mockProduct({ id: 'p1' });
    const p2 = mockProduct({ id: 'p2' });
    productRepo.find.mockResolvedValue([p1, p2]);
    openAi.chat.mockResolvedValue({
      content: {
        results: [{ id: 'p1', match: true, confidence: 0.9, issue: null }],
      },
      estimatedCostUsd: 0.0001,
    });

    const summary = await svc.verifyJob('job-1');

    expect(summary.status).toBe('partial');
    expect(summary.processedProducts).toBe(1);
    expect(summary.unprocessedProductIds).toEqual(['p2']);
    expect(productRepo.query).not.toHaveBeenCalled();
  });

  it('leaves the whole chunk unprocessed and does not flag anything on a chunk-level failure', async () => {
    const p1 = mockProduct({ id: 'p1' });
    const p2 = mockProduct({ id: 'p2' });
    productRepo.find.mockResolvedValue([p1, p2]);
    openAi.chat.mockRejectedValue(new Error('upstream 500'));

    const summary = await svc.verifyJob('job-1');

    expect(summary.status).toBe('partial');
    expect(summary.processedProducts).toBe(0);
    expect(summary.flaggedCount).toBe(0);
    expect(summary.unprocessedProductIds.sort()).toEqual(['p1', 'p2']);
    expect(productRepo.query).not.toHaveBeenCalled();
  });

  it('accumulates cost across multiple chunks', async () => {
    process.env.TITLE_VERIFICATION_BATCH_SIZE = '1';
    const p1 = mockProduct({ id: 'p1' });
    const p2 = mockProduct({ id: 'p2' });
    productRepo.find.mockResolvedValue([p1, p2]);
    openAi.chat
      .mockResolvedValueOnce({
        content: { results: [{ id: 'p1', match: true, confidence: 0.9, issue: null }] },
        estimatedCostUsd: 0.0001,
      })
      .mockResolvedValueOnce({
        content: { results: [{ id: 'p2', match: true, confidence: 0.9, issue: null }] },
        estimatedCostUsd: 0.00015,
      });

    const summary = await svc.verifyJob('job-1');

    expect(openAi.chat).toHaveBeenCalledTimes(2);
    expect(summary.estimatedCostUsd).toBeCloseTo(0.00025);
    expect(summary.status).toBe('completed');
  });

  it('returns an empty completed summary when the job has no products', async () => {
    productRepo.find.mockResolvedValue([]);

    const summary = await svc.verifyJob('job-1');

    expect(summary).toMatchObject({
      status: 'completed',
      totalProducts: 0,
      processedProducts: 0,
      flaggedCount: 0,
      unprocessedProductIds: [],
      estimatedCostUsd: 0,
    });
    expect(openAi.chat).not.toHaveBeenCalled();
  });
});
