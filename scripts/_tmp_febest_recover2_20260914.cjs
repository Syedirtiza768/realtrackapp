require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/app/dist/src/app.module.js');
const { PipelineService } = require('/app/dist/src/ingestion/pipeline.service.js');
const id = process.argv[2];
const lockToken = process.argv[3];
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const pipeline = app.get(PipelineService);
    const queueJob = await pipeline.pipelineQueue.getJob(`pipeline-${id}`);
    if (!queueJob) throw new Error(`BullMQ job not found for ${id}`);
    await queueJob.moveToFailed(new Error('Temporary importer context ended before processing; safe application retry'), lockToken, false);
    const cancelled = await pipeline.cancelJob(id, undefined, true);
    console.log(JSON.stringify({ movedQueueJobToFailed: true, jobId: id, dbStatus: cancelled.status }));
  } catch (error) {
    console.error(JSON.stringify({ movedQueueJobToFailed: false, jobId: id, error: error?.message || String(error) }));
    process.exitCode = 1;
  } finally {
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
