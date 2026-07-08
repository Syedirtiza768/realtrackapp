import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ServiceUnavailableException } from '@nestjs/common';
import { CatalogImport } from '../../catalog-import/entities/catalog-import.entity.js';
import { PipelineJob } from '../../ingestion/entities/pipeline-job.entity.js';
import { HeavyJobLimiterService } from './heavy-job-limiter.service.js';

describe('HeavyJobLimiterService', () => {
  let service: HeavyJobLimiterService;
  let pipelineCount: jest.Mock;
  let pipelineFind: jest.Mock;
  let importCount: jest.Mock;
  let configGet: jest.Mock;

  beforeEach(async () => {
    pipelineCount = jest.fn();
    pipelineFind = jest.fn().mockResolvedValue([]);
    importCount = jest.fn();
    configGet = jest.fn((key: string, fallback?: string) => {
      if (key === 'MAX_CONCURRENT_PIPELINE_JOBS') return '2';
      if (key === 'MAX_CONCURRENT_CATALOG_IMPORTS') return '2';
      if (key === 'PIPELINE_JOB_STALE_MINUTES') return '360';
      return fallback;
    });

    const module = await Test.createTestingModule({
      providers: [
        HeavyJobLimiterService,
        {
          provide: getRepositoryToken(PipelineJob),
          useValue: {
            count: pipelineCount,
            find: pipelineFind,
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CatalogImport),
          useValue: { count: importCount },
        },
        {
          provide: getQueueToken('pipeline'),
          useValue: {
            getWaiting: jest.fn().mockResolvedValue([]),
            getActive: jest.fn().mockResolvedValue([]),
            getDelayed: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();

    service = module.get(HeavyJobLimiterService);
  });

  it('allows pipeline job when under capacity', async () => {
    pipelineCount.mockResolvedValue(1);
    await expect(
      service.assertPipelineSlotAvailable(),
    ).resolves.toBeUndefined();
  });

  it('rejects pipeline job when at capacity', async () => {
    pipelineCount.mockResolvedValue(2);
    await expect(service.assertPipelineSlotAvailable()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('allows catalog import when under capacity', async () => {
    importCount.mockResolvedValue(0);
    await expect(
      service.assertCatalogImportSlotAvailable(),
    ).resolves.toBeUndefined();
  });

  it('rejects catalog import when at capacity', async () => {
    importCount.mockResolvedValue(2);
    await expect(
      service.assertCatalogImportSlotAvailable(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('skips pipeline cap when MAX_CONCURRENT_PIPELINE_JOBS is 0', async () => {
    configGet.mockImplementation((key: string, fallback?: string) => {
      if (key === 'MAX_CONCURRENT_PIPELINE_JOBS') return '0';
      return fallback;
    });
    pipelineCount.mockResolvedValue(99);
    await expect(
      service.assertPipelineSlotAvailable(),
    ).resolves.toBeUndefined();
    expect(pipelineCount).not.toHaveBeenCalled();
  });
});
