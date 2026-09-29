require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/app/dist/src/app.module.js');
const { PipelineService } = require('/app/dist/src/ingestion/pipeline.service.js');

const jobId = process.argv[2];
if (!jobId) throw new Error('job id is required');

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const pipeline = app.get(PipelineService);
    const queue = pipeline.pipelineQueue;
    const queueJob = await queue.getJob(`pipeline-${jobId}`);
    if (!queueJob) throw new Error(`BullMQ job not found for ${jobId}`);
    const state = await queueJob.getState();
    await queueJob.remove();
    const cancelled = await pipeline.cancelJob(jobId, undefined, true);
    console.log(JSON.stringify({ removedQueueJob: true, priorQueueState: state, jobId, dbStatus: cancelled.status }));
  } catch (error) {
    console.error(JSON.stringify({ removedQueueJob: false, jobId, error: error?.message || String(error) }));
    process.exitCode = 1;
  } finally {
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
