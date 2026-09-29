require('reflect-metadata');

const fs = require('node:fs');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/app/dist/src/app.module.js');
const { PipelineService } = require('/app/dist/src/ingestion/pipeline.service.js');

const filePath = process.argv[2];
const originalFilename = process.argv[3] || filePath.split('/').pop();
if (!filePath) throw new Error('file path is required');

(async () => {
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const pipeline = app.get(PipelineService);
    const job = await pipeline.createJobFromUpload(
      originalFilename,
      fs.readFileSync(filePath),
      undefined,
      '7390e246-3b70-4c8e-ab09-94ada2992fbb',
      'Used',
      true,
      {
        marketplace: 'US',
        storeId: 'd16199c4-55b5-429e-ad27-892bed94e00d',
        shippingProfileName: 'BLAP shipping policy 3 KG',
        returnProfileName: 'BL Auto Return policy 1',
        paymentProfileName: 'BL Auto Payment Policy 1',
      },
      undefined,
      'automotive',
      'pre_enriched_febest_v1',
    );
    console.log(JSON.stringify({ id: job.id, status: job.status, originalFilename: job.originalFilename, totalParts: job.totalParts, teamId: job.teamId, storeId: job.storeId, importMode: 'pre_enriched_febest_v1' }));
  } catch (error) {
    console.error(JSON.stringify({ error: error?.message || String(error), stack: error?.stack }));
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
  }
})();
