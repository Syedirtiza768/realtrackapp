import { BusinessIndustrialImageIntakeService } from './business-industrial-image-intake.service.js';

type IntakeGroup = {
  id: string;
  detectionStatus: string;
  rawFolderNames: string[];
  updatedAt?: Date;
};

describe('BusinessIndustrialImageIntakeService retry lifecycle', () => {
  function setup(groups: IntakeGroup[], status = 'partial') {
    const job = {
      id: 'job-1',
      organizationId: 'org-1',
      status,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      processedFolders: 0,
      processedImages: 0,
      failedFolders: 0,
    } as Record<string, unknown>;
    const queue = {
      add: jest
        .fn<Promise<void>, [string, { jobId: string }, { jobId: string }]>()
        .mockResolvedValue(undefined),
    };
    const jobRepo = {
      findOne: jest.fn().mockResolvedValue(job),
      save: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockImplementation((value) => Promise.resolve(value)),
    };
    const groupRepo = {
      find: jest.fn().mockResolvedValue(groups),
      count: jest.fn().mockResolvedValue(0),
      save: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockImplementation((value) => Promise.resolve(value)),
    };
    const assetRepo = {
      count: jest
        .fn()
        .mockImplementation(({ where }: { where: { groupId: string } }) =>
          where.groupId === 'done' ? 3 : 2,
        ),
    };
    const service = new BusinessIndustrialImageIntakeService(
      { get: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
      jobRepo as never,
      groupRepo as never,
      assetRepo as never,
      {} as never,
      {} as never,
      {} as never,
    );
    (service as unknown as { findJob: jest.Mock }).findJob = jest
      .fn()
      .mockResolvedValue(job);
    return { service, job, queue, jobRepo, groupRepo, assetRepo };
  }

  it('does not enqueue an already completed set of groups', async () => {
    const { service, job, queue, jobRepo } = setup([
      { id: 'done', detectionStatus: 'detected', rawFolderNames: ['BNI-1'] },
    ]);

    const result = await service.startJob({} as never, 'job-1');

    expect(queue.add).not.toHaveBeenCalled();
    expect(job.status).toBe('completed');
    expect(jobRepo.save).toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });

  it('uses a unique BullMQ id when retrying failed groups', async () => {
    const { service, queue } = setup([
      { id: 'failed', detectionStatus: 'failed', rawFolderNames: ['BNI-2'] },
    ]);

    await service.startJob({} as never, 'job-1');

    expect(queue.add).toHaveBeenCalledWith(
      'detect',
      { jobId: 'job-1' },
      expect.any(Object),
    );
    expect(queue.add.mock.calls[0][2].jobId).toMatch(
      /^bi-image-intake-job-1-\d+$/,
    );
  });

  it('recovers a stale processing group when a partial job is restarted', async () => {
    const stale = {
      id: 'stale',
      detectionStatus: 'processing',
      rawFolderNames: ['BNI-3'],
      updatedAt: new Date(Date.now() - 16 * 60 * 1000),
    };
    const { service, queue, groupRepo } = setup([stale]);

    await service.startJob({} as never, 'job-1');

    expect(stale.detectionStatus).toBe('pending');
    expect(groupRepo.save).toHaveBeenCalledWith(stale);
    expect(queue.add).toHaveBeenCalledWith(
      'detect',
      { jobId: 'job-1' },
      expect.any(Object),
    );
  });

  it('preserves successful groups and processes only pending or failed groups', async () => {
    const done = {
      id: 'done',
      detectionStatus: 'detected',
      rawFolderNames: ['BNI-1'],
    };
    const failed = {
      id: 'failed',
      detectionStatus: 'failed',
      rawFolderNames: ['BNI-2', 'BNI-2.1'],
    };
    const { service, job, groupRepo } = setup([done, failed], 'processing');
    const detectGroup = jest
      .fn<Promise<void>, [unknown, IntakeGroup]>()
      .mockImplementation((_job, group) => {
        group.detectionStatus = 'detected';
        return Promise.resolve();
      });
    (service as unknown as { detectGroup: jest.Mock }).detectGroup =
      detectGroup;

    await service.processJob('job-1');

    expect(detectGroup).toHaveBeenCalledTimes(1);
    expect(detectGroup).toHaveBeenCalledWith(job, failed);
    expect(job.processedFolders).toBe(3);
    expect(job.processedImages).toBe(5);
    expect(job.status).toBe('completed');
    expect(groupRepo.count).toHaveBeenCalled();
  });

  it('broadens taxonomy queries with deliberate B&I family context', () => {
    const { service } = setup([]);
    const queries = (
      service as unknown as {
        businessIndustrialCategoryQueries: (
          candidate: Record<string, unknown>,
          basePartName: string,
        ) => string[];
      }
    ).businessIndustrialCategoryQueries(
      {
        categorySearchQuery: 'Siemens LOGO programmable logic controller',
        brand: 'Siemens',
        model: 'LOGO! 12/24RC',
        partType: 'Programmable Logic Controller',
        categoryFamily: 'industrial_automation',
      },
      'BNI-1',
    );

    expect(queries).toEqual([
      'Siemens LOGO programmable logic controller',
      'Siemens LOGO! 12/24RC Programmable Logic Controller Industrial automation & controls',
      'Programmable Logic Controller Industrial automation & controls',
      'LOGO! 12/24RC Programmable Logic Controller',
      'BNI-1 Industrial automation & controls',
    ]);
  });

  it('builds a deterministic BNI SKU from the base folder and strips the BNI folder prefix', () => {
    const { service } = setup([]);
    const sku = (
      service as unknown as {
        catalogSkuFromFolderName: (folderName: string) => string;
      }
    ).catalogSkuFromFolderName;

    expect(sku('BNI-20')).toBe('BNI-20');
    expect(sku('RHINO AutomationDirect PS24-075D 75W 24VDC 3A DIN')).toBe(
      'BNI-rhinoautomationdirectps24075d75w24vdc3adin',
    );
  });
});
