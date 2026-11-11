import { ListingOptimizationService } from './listing-optimization.service.js';
import type { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';

describe('ListingOptimizationService explicit job reruns', () => {
  const jobId = '7239edb3-770b-4b18-a60f-288b5bdeba8c';

  afterEach(() => {
    jest.useRealTimers();
  });

  it('forces all products when Optimize All is explicitly requested', async () => {
    const job = {
      id: jobId,
      originalFilename: '2013 VOLKSWAGEN Golf GTI.xlsx',
      optimizationByMarketplace: {
        US: { status: 'needs_review', processed: 145, total: 145 },
      },
    } as unknown as PipelineJob;
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ sku: 'SKU-1' }]),
    };
    const productRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'product-1', sku: 'SKU-1' }]),
    };
    const listingRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const jobRepo = {
      findOneBy: jest.fn().mockResolvedValue(job),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ListingOptimizationService(
      productRepo as never,
      listingRepo as never,
      jobRepo as never,
      {} as never,
      {} as never,
    );
    const optimizeBatch = jest
      .spyOn(service, 'optimizeProductsBatch')
      .mockResolvedValue(undefined);
    const internals = service as unknown as {
      mergeOptimizationByMarketplace: (...args: unknown[]) => Promise<void>;
      refreshJobOptimizationCounts: (...args: unknown[]) => Promise<void>;
      refreshJobOptimizationAggregate: (...args: unknown[]) => Promise<void>;
    };
    jest
      .spyOn(internals, 'mergeOptimizationByMarketplace')
      .mockResolvedValue(undefined);
    jest
      .spyOn(internals, 'refreshJobOptimizationCounts')
      .mockResolvedValue(undefined);
    jest
      .spyOn(internals, 'refreshJobOptimizationAggregate')
      .mockResolvedValue(undefined);

    jest.useFakeTimers();
    await service.enqueueJobOptimization(jobId, 'US', undefined, {
      force: true,
    });
    jest.runOnlyPendingTimers();

    expect(optimizeBatch).toHaveBeenCalledWith(['product-1'], 'US', {
      force: true,
      sourceFilename: '2013 VOLKSWAGEN Golf GTI.xlsx',
    });
  });

  it('keeps background calls idempotent for an already-reviewed job', async () => {
    const job = {
      id: jobId,
      optimizationByMarketplace: { US: { status: 'needs_review' } },
    } as unknown as PipelineJob;
    const productRepo = { find: jest.fn() };
    const service = new ListingOptimizationService(
      productRepo as never,
      {} as never,
      { findOneBy: jest.fn().mockResolvedValue(job) } as never,
      {} as never,
      {} as never,
    );
    const internals = service as unknown as {
      refreshJobOptimizationAggregate: (...args: unknown[]) => Promise<void>;
    };
    jest
      .spyOn(internals, 'refreshJobOptimizationAggregate')
      .mockResolvedValue(undefined);
    const optimizeBatch = jest.spyOn(service, 'optimizeProductsBatch');

    await service.enqueueJobOptimization(jobId);

    expect(optimizeBatch).not.toHaveBeenCalled();
    expect(productRepo.find).not.toHaveBeenCalled();
  });
});
