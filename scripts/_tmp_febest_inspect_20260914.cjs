require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/app/dist/src/app.module.js');
const { PipelineService } = require('/app/dist/src/ingestion/pipeline.service.js');
const id = process.argv[2];
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const queueJob = await app.get(PipelineService).pipelineQueue.getJob(`pipeline-${id}`);
    console.log(JSON.stringify({ state: await queueJob.getState(), token: queueJob.token, keys: Object.keys(queueJob), processedOn: queueJob.processedOn, attemptsMade: queueJob.attemptsMade }));
  } finally {
    setTimeout(() => process.exit(0), 250);
  }
})();
