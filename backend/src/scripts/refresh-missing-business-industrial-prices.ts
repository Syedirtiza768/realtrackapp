import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { User } from '../auth/entities/user.entity.js';
import { BusinessIndustrialImageIntakeService } from '../verticals/business-industrial-image-intake.service.js';
import { BusinessIndustrialImageIntakeJob } from '../verticals/entities/business-industrial-image-intake-job.entity.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const jobs = app.get<Repository<BusinessIndustrialImageIntakeJob>>(
      getRepositoryToken(BusinessIndustrialImageIntakeJob),
    );
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const latestJob = await jobs.findOne({
      where: { createdByUserId: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    });
    if (!latestJob?.createdByUserId)
      throw new Error('No B&I intake operator was found');
    const user = await users.findOne({
      where: { id: latestJob.createdByUserId, active: true },
    });
    if (!user) throw new Error('The latest B&I intake operator is unavailable');

    const intake = app.get(BusinessIndustrialImageIntakeService);
    const result = await intake.refreshBusinessIndustrialPrices(
      user,
      latestJob.organizationId,
      200,
      (progress) => console.log(JSON.stringify({ phase: 'progress', ...progress })),
      true,
    );
    console.log(
      JSON.stringify({
        phase: 'complete',
        processed: result.processed,
        updated: result.updated,
        skipped: result.skipped,
        skippedSkus: result.results
          .filter((row) => row.status === 'skipped')
          .map((row) => row.sku),
        published: false,
      }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
