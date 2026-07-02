const { Queue } = require('bullmq');
const q = new Queue('pipeline', { connection: { host: 'redis', port: 6379 } });
q.add(
  'run-pipeline',
  {
    jobId: 'abaca78f-adc5-4ac2-acb0-ea2e6e2ab150',
    filePath:
      '/app/uploads/pipeline/abaca78f-adc5-4ac2-acb0-ea2e6e2ab150/1782976335515_TCTEST1.xlsx',
    originalFilename: 'TCTEST1.xlsx',
  },
  {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
)
  .then((job) => {
    console.log('Re-queued abaca78f as bull job', job.id);
    return q.close();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
