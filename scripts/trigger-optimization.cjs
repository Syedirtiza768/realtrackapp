const { NestFactory } = require('@nestjs/core');
const { getQueueToken } = require('@nestjs/bullmq');

async function main() {
  const { AppModule } = await import('/app/dist/src/app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });

  try {
    const queue = app.get(getQueueToken('listing-optimization'));
    const jobId = '572e96dd-d1e5-4a8f-bdd4-1ee25e809677';

    const job = await queue.add('optimize-job', { jobId, marketplace: 'US' }, {
      jobId: `pipeline-optimization-${jobId}-US`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
    });

    console.log('Queued optimization job:', job.id);
    console.log('Job data:', JSON.stringify(job.data));

    // Check queue status
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    console.log('Queue status:', { waiting, active, completed, failed });
  } finally {
    await app.close();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
