import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { User } from '../auth/entities/user.entity.js';
import { BusinessIndustrialImageIntakeService } from '../verticals/business-industrial-image-intake.service.js';
import { BusinessIndustrialImageIntakeGroup } from '../verticals/entities/business-industrial-image-intake-group.entity.js';
import { BusinessIndustrialImageIntakeJob } from '../verticals/entities/business-industrial-image-intake-job.entity.js';

const LUNA_MODEL = 'openai/gpt-5.6-luna-20260709';
const DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1kZ9x4dSwrptDEYreYcfo4mYaYYA2plY5?usp=drive_link';
const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed']);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDriveFolder(
  intake: BusinessIndustrialImageIntakeService,
  jobs: Repository<BusinessIndustrialImageIntakeJob>,
  groups: Repository<BusinessIndustrialImageIntakeGroup>,
  user: User,
  folderUrl: string,
): Promise<Record<string, unknown>> {
  const queued = await intake.createDriveJob(user, {
    folderUrl,
    maxItems: 200,
    autoCreateDrafts: true,
    skipFolderNames: [],
  });
  console.log(JSON.stringify({ phase: 'queued', source: folderUrl, job: queued }));

  const startedAt = Date.now();
  const deadline = startedAt + 4 * 60 * 60 * 1000;
  let lastProgress = '';
  let current: BusinessIndustrialImageIntakeJob | null = null;
  while (Date.now() < deadline) {
    current = await jobs.findOne({ where: { id: queued.id } });
    if (!current) throw new Error('The queued intake job disappeared');
    const progress = [
      current.status,
      current.processedFolders,
      current.processedImages,
      current.groupedParts,
    ].join('/');
    if (progress !== lastProgress) {
      const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 1);
      const rate = current.processedImages / elapsedSeconds;
      const etaSeconds =
        current.totalImages > current.processedImages && rate > 0
          ? Math.ceil((current.totalImages - current.processedImages) / rate)
          : null;
      console.log(
        JSON.stringify({
          phase: 'progress',
          source: folderUrl,
          status: current.status,
          percent:
            current.totalImages > 0
              ? Math.round(
                  (current.processedImages / current.totalImages) * 100,
                )
              : null,
          etaSeconds,
          processedFolders: current.processedFolders,
          processedImages: current.processedImages,
          totalFolders: current.totalFolders,
          totalImages: current.totalImages,
          groupedParts: current.groupedParts,
          failedFolders: current.failedFolders,
        }),
      );
      lastProgress = progress;
    }
    if (TERMINAL_STATUSES.has(current.status)) break;
    await delay(5000);
  }
  if (!current || !TERMINAL_STATUSES.has(current.status))
    throw new Error('Timed out waiting for the B&I Drive intake worker');
  if (current.status === 'failed')
    throw new Error(current.errorMessage || 'B&I Drive intake failed');

  const importedGroups = await groups.find({
    where: { jobId: current.id, organizationId: current.organizationId },
  });
  const groupCounts = importedGroups.reduce<Record<string, number>>(
    (counts, group) => {
      counts[group.detectionStatus] =
        (counts[group.detectionStatus] ?? 0) + 1;
      return counts;
    },
    {},
  );
  return {
    organizationId: current.organizationId,
    id: current.id,
    status: current.status,
    totalFolders: current.totalFolders,
    totalImages: current.totalImages,
    processedFolders: current.processedFolders,
    processedImages: current.processedImages,
    groupedParts: current.groupedParts,
    failedFolders: current.failedFolders,
    groups: groupCounts,
    groupsWithCatalogProducts: importedGroups.filter(
      (group) => Boolean(group.catalogProductId),
    ).length,
  };
}

async function main(): Promise<void> {
  const userId = process.argv[2]?.trim();
  const folderUrls = process.argv
    .slice(3)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!folderUrls.length) folderUrls.push(DRIVE_FOLDER_URL);
  if (!userId)
    throw new Error(
      'Usage: node dist/src/scripts/run-business-industrial-completion.js <existing-bni-admin-user-id> [drive-folder-url ...]',
    );

  // Keep the entire completion run on the user-requested model, including
  // vision and evidence-bound listing text.
  process.env.BUSINESS_INDUSTRIAL_AI_MODEL = LUNA_MODEL;
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const user = await users.findOne({ where: { id: userId } });
    if (!user || !user.active)
      throw new Error('The supplied B&I admin user does not exist or is inactive');

    const intake = app.get(BusinessIndustrialImageIntakeService);
    const jobs = app.get<Repository<BusinessIndustrialImageIntakeJob>>(
      getRepositoryToken(BusinessIndustrialImageIntakeJob),
    );
    const groups = app.get<Repository<BusinessIndustrialImageIntakeGroup>>(
      getRepositoryToken(BusinessIndustrialImageIntakeGroup),
    );

    const jobSummaries: Array<Record<string, unknown>> = [];
    const folderErrors: Array<Record<string, string>> = [];
    for (const folderUrl of folderUrls) {
      try {
        jobSummaries.push(
          await runDriveFolder(intake, jobs, groups, user, folderUrl),
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Drive intake failed';
        folderErrors.push({ folderUrl, message });
        console.error(JSON.stringify({ phase: 'folder-error', source: folderUrl, message }));
      }
    }
    if (!jobSummaries.length)
      throw new Error('All supplied B&I Drive folders failed');
    const organizationId = String(jobSummaries[0].organizationId);
    const pricing = await intake.refreshBusinessIndustrialPrices(
      user,
      organizationId,
      200,
      (progress) => {
        console.log(JSON.stringify({ phase: 'pricing-progress', ...progress }));
      },
    );
    const skippedPricingSkus = pricing.results
      .filter((result) => result.status === 'skipped')
      .map((result) => result.sku)
      .filter((sku): sku is string => typeof sku === 'string');
    console.log(
      JSON.stringify({
        phase: 'complete',
        jobs: jobSummaries,
        folderErrors,
        pricing: {
          processed: pricing.processed,
          updated: pricing.updated,
          skipped: pricing.skipped,
          skippedSkus: skippedPricingSkus,
        },
        model: LUNA_MODEL,
        published: false,
      }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
