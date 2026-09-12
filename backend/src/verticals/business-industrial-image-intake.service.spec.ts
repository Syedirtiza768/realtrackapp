import { BusinessIndustrialImageIntakeService } from './business-industrial-image-intake.service.js';

type IntakeGroup = {
  id: string;
  detectionStatus: string;
  rawFolderNames: string[];
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
});
