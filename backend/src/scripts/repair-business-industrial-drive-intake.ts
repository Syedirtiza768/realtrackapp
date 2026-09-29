import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingOrigin, ListingRecord } from '../listings/listing-record.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { BusinessIndustrialReview } from '../verticals/entities/business-industrial-review.entity.js';
import { BusinessIndustrialImageIntakeAsset } from '../verticals/entities/business-industrial-image-intake-asset.entity.js';
import { BusinessIndustrialImageIntakeGroup } from '../verticals/entities/business-industrial-image-intake-group.entity.js';
import { BusinessIndustrialImageIntakeJob } from '../verticals/entities/business-industrial-image-intake-job.entity.js';
import { BusinessIndustrialImageIntakeService } from '../verticals/business-industrial-image-intake.service.js';
import { applyBusinessIndustrialFulfillmentDefaults } from '../verticals/business-industrial-image-intake.util.js';

const CATEGORY_OVERRIDES: Record<string, { id: string; name: string }> = {
  'BNI-106.2': { id: '67882', name: 'Signal Finders' },
  'RDI-8': { id: '184501', name: 'Medical Carts & Stands' },
  'RDI-9': { id: '184501', name: 'Medical Carts & Stands' },
};

type SourceMarker = {
  jobId: string;
  groupId: string;
  sourceReferenceUrl: string | null;
  sourceFolderName: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function folderSku(folderName: string): string {
  const normalized = folderName
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s\-_\/\\]+/g, '');
  const suffix = normalized.startsWith('bni') ? normalized.slice(3) : normalized;
  return `BNI-${(suffix || 'unassigned').slice(0, 156)}`;
}

function sourceToken(referenceUrl: string | null): string {
  const folderId = referenceUrl
    ? /\/folders\/([^/?#]+)/.exec(referenceUrl)?.[1]
    : null;
  return (folderId || 'intake')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 12)
    .toLowerCase() || 'intake';
}

function markerFor(
  job: BusinessIndustrialImageIntakeJob,
  group: BusinessIndustrialImageIntakeGroup,
): SourceMarker {
  return {
    jobId: job.id,
    groupId: group.id,
    sourceReferenceUrl: job.sourceReferenceUrl,
    sourceFolderName: group.basePartName,
  };
}

function matchesSource(product: CatalogProduct, marker: SourceMarker): boolean {
  const source = asRecord(
    asRecord(product.optimizationPayload).__businessIndustrialIntake,
  );
  return (
    source.sourceReferenceUrl === marker.sourceReferenceUrl &&
    source.sourceFolderName === marker.sourceFolderName
  );
}

async function uniqueSku(
  products: Repository<CatalogProduct>,
  organizationId: string,
  baseSku: string,
  marker: SourceMarker,
): Promise<string> {
  const existing = await products.findOne({
    where: {
      organizationId,
      vertical: 'business_industrial',
      sku: baseSku,
    },
  });
  if (!existing || matchesSource(existing, marker)) return baseSku;
  const token = sourceToken(marker.sourceReferenceUrl);
  const suffix = `-${token}`;
  let candidate = `${baseSku.slice(0, 160 - suffix.length)}${suffix}`;
  let counter = 2;
  while (
    await products.findOne({
      where: {
        organizationId,
        vertical: 'business_industrial',
        sku: candidate,
      },
    })
  ) {
    const nextSuffix = `-${token}-${counter++}`;
    candidate = `${baseSku.slice(0, 160 - nextSuffix.length)}${nextSuffix}`;
  }
  return candidate;
}

async function copyReview(
  reviews: Repository<BusinessIndustrialReview>,
  source: BusinessIndustrialReview | null,
  product: CatalogProduct,
  approve: boolean,
  userId: string,
): Promise<void> {
  const review = reviews.create({
    ...(source ?? {}),
    id: undefined,
    organizationId: product.organizationId!,
    catalogProductId: product.id,
    status: approve ? 'approved' : source?.status ?? 'pending',
    provenanceConfirmed: approve || source?.provenanceConfirmed || false,
    specificationsVerified: approve || source?.specificationsVerified || false,
    testingReviewed: approve || source?.testingReviewed || false,
    restrictedCategoryCleared:
      approve || source?.restrictedCategoryCleared || false,
    reviewedByUserId: approve ? userId : source?.reviewedByUserId ?? null,
    reviewedAt: approve ? new Date() : source?.reviewedAt ?? null,
    reviewedProductUpdatedAt: product.updatedAt,
    notes: approve
      ? 'Operator-authorized B&I intake readiness backfill; source images and evidence remain attached.'
      : source?.notes ?? null,
  });
  await reviews.save(review);
}

async function main(): Promise<void> {
  const userId = process.argv[2]?.trim();
  const jobIds = process.argv.slice(3).filter((value) => !value.startsWith('--'));
  const approve = process.argv.includes('--operator-authorized-ready');
  if (!userId || jobIds.length === 0)
    throw new Error(
      'Usage: repair-business-industrial-drive-intake <user-id> <job-id> [job-id ...] [--operator-authorized-ready]',
    );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const jobs = app.get<Repository<BusinessIndustrialImageIntakeJob>>(
      getRepositoryToken(BusinessIndustrialImageIntakeJob),
    );
    const groups = app.get<Repository<BusinessIndustrialImageIntakeGroup>>(
      getRepositoryToken(BusinessIndustrialImageIntakeGroup),
    );
    const assets = app.get<Repository<BusinessIndustrialImageIntakeAsset>>(
      getRepositoryToken(BusinessIndustrialImageIntakeAsset),
    );
    const products = app.get<Repository<CatalogProduct>>(
      getRepositoryToken(CatalogProduct),
    );
    const listings = app.get<Repository<ListingRecord>>(
      getRepositoryToken(ListingRecord),
    );
    const reviews = app.get<Repository<BusinessIndustrialReview>>(
      getRepositoryToken(BusinessIndustrialReview),
    );
    const intake = app.get(BusinessIndustrialImageIntakeService);
    const user = await users.findOne({ where: { id: userId } });
    if (!user?.active) throw new Error('The supplied operator user is inactive or missing');

    const selectedJobs = await jobs.find({ where: { id: In(jobIds) } });
    if (selectedJobs.length !== jobIds.length)
      throw new Error('One or more supplied B&I intake jobs were not found');
    const jobById = new Map(selectedJobs.map((job) => [job.id, job]));

    for (const job of selectedJobs) {
      await intake.processJob(job.id, true, true);
    }

    const selectedGroups = await groups.find({
      where: { jobId: In(jobIds) },
      order: { createdAt: 'ASC' },
    });
    const organizationId = selectedJobs[0].organizationId;
    const rank = new Map(jobIds.map((id, index) => [id, index]));
    const groupsByProduct = new Map<string, BusinessIndustrialImageIntakeGroup[]>();
    for (const group of selectedGroups) {
      if (!group.catalogProductId) continue;
      groupsByProduct.set(group.catalogProductId, [
        ...(groupsByProduct.get(group.catalogProductId) ?? []),
        group,
      ]);
    }

    let cloned = 0;
    for (const linkedGroups of groupsByProduct.values()) {
      if (linkedGroups.length < 2) continue;
      linkedGroups.sort((left, right) => (rank.get(left.jobId) ?? 999) - (rank.get(right.jobId) ?? 999));
      const retainedGroup = linkedGroups[0];
      const sourceProduct = await products.findOne({ where: { id: retainedGroup.catalogProductId! } });
      if (!sourceProduct || !sourceProduct.organizationId) continue;
      const sourceReview = await reviews.findOne({
        where: {
          organizationId: sourceProduct.organizationId,
          catalogProductId: sourceProduct.id,
        },
      });
      for (const duplicateGroup of linkedGroups.slice(1)) {
        const job = jobById.get(duplicateGroup.jobId)!;
        const marker = markerFor(job, duplicateGroup);
        const existingForSource = await products
          .createQueryBuilder('product')
          .where('product.organizationId = :organizationId', { organizationId })
          .andWhere('product.vertical = :vertical', { vertical: 'business_industrial' })
          .andWhere(`product.optimizationPayload -> '__businessIndustrialIntake' ->> 'sourceReferenceUrl' = :sourceReferenceUrl`, { sourceReferenceUrl: marker.sourceReferenceUrl })
          .andWhere(`product.optimizationPayload -> '__businessIndustrialIntake' ->> 'sourceFolderName' = :sourceFolderName`, { sourceFolderName: marker.sourceFolderName })
          .getOne();
        if (existingForSource) {
          duplicateGroup.catalogProductId = existingForSource.id;
          await groups.save(duplicateGroup);
          continue;
        }
        const imageUrls = (await assets.find({
          where: { groupId: duplicateGroup.id, organizationId },
          order: { createdAt: 'ASC' },
        })).map((asset) => asset.cdnUrl);
        const sku = await uniqueSku(
          products,
          organizationId,
          folderSku(duplicateGroup.basePartName),
          marker,
        );
        const clone = products.create({
          ...sourceProduct,
          id: undefined,
          sku,
          ebayItemId: null,
          epid: null,
          imageUrls: imageUrls.length ? imageUrls : sourceProduct.imageUrls,
          optimizationPayload: {
            ...asRecord(sourceProduct.optimizationPayload),
            __businessIndustrialIntake: marker,
          },
        });
        const saved = await products.save(clone);
        await copyReview(reviews, sourceReview, saved, approve, user.id);
        const sourceListing = sourceProduct.sku
          ? await listings.findOne({
              where: {
                organizationId,
                vertical: 'business_industrial',
                customLabelSku: sourceProduct.sku,
              },
            })
          : null;
        if (sourceListing) {
          const listing = listings.create({
            ...sourceListing,
            id: undefined,
            customLabelSku: sku,
            sourceFileName: `business-industrial-intake-${job.id}`,
            sourceFilePath: `business-industrial-intake:${job.id}`,
            sheetName: duplicateGroup.id,
            sourceRowNumber: 1,
            itemPhotoUrl: saved.imageUrls.join('|') || null,
            categoryId: saved.categoryId,
            categoryName: saved.categoryName,
            cManufacturerPartNumber: saved.mpn,
          });
          await listings.save(listing);
        } else {
          await listings.save(
            listings.create({
              organizationId,
              vertical: 'business_industrial',
              verticalAttributes: saved.verticalAttributes,
              sourceFileName: `business-industrial-intake-${job.id}`,
              sourceFilePath: `business-industrial-intake:${job.id}`,
              sheetName: duplicateGroup.id,
              sourceRowNumber: 1,
              origin: ListingOrigin.ADD_PART,
              action: 'Add',
              customLabelSku: sku,
              categoryId: saved.categoryId,
              categoryName: saved.categoryName,
              title: saved.title,
              startPrice: saved.price == null ? null : String(saved.price),
              startPriceNum: saved.price,
              quantity: saved.quantity == null ? null : String(saved.quantity),
              quantityNum: saved.quantity,
              itemPhotoUrl: saved.imageUrls.join('|') || null,
              conditionId: saved.conditionId,
              conditionLabel: saved.conditionLabel,
              description: saved.description,
              format: 'FixedPrice',
              duration: 'GTC',
              cBrand: saved.brand,
              cType: saved.partType,
              cManufacturerPartNumber: saved.mpn,
              status: 'draft',
              enrichmentStage: 'completed',
            }),
          );
        }
        duplicateGroup.catalogProductId = saved.id;
        duplicateGroup.detectionStatus = 'draft_created';
        duplicateGroup.errorMessage = null;
        await groups.save(duplicateGroup);
        cloned++;
      }
    }

    let updated = 0;
    for (const group of selectedGroups) {
      if (!group.catalogProductId) continue;
      const product = await products.findOne({ where: { id: group.catalogProductId } });
      if (!product || !product.organizationId) continue;
      const job = jobById.get(group.jobId)!;
      const marker = markerFor(job, group);
      const override = CATEGORY_OVERRIDES[group.basePartName.trim()];
      const attributes = applyBusinessIndustrialFulfillmentDefaults(
        asRecord(product.verticalAttributes),
        {
          dispatchLocation: process.env.BUSINESS_INDUSTRIAL_DEFAULT_DISPATCH_LOCATION || 'United States',
          shippingCoverage: process.env.BUSINESS_INDUSTRIAL_DEFAULT_SHIPPING_COVERAGE || 'United States',
        },
      );
      product.verticalAttributes = attributes as CatalogProduct['verticalAttributes'];
      product.optimizationPayload = {
        ...asRecord(product.optimizationPayload),
        __businessIndustrialIntake: marker,
      };
      if (override) {
        product.categoryId = override.id;
        product.categoryName = override.name;
      }
      if (!product.mpn?.trim()) product.mpn = 'Does Not Apply';
      product.ebayValidationStatus = null;
      product.manualReview = false;
      if (approve) product.verticalValidationStatus = 'approved';
      await products.save(product);
      const review = await reviews.findOne({
        where: { organizationId: product.organizationId, catalogProductId: product.id },
      });
      if (approve) {
        if (review) {
          review.status = 'approved';
          review.provenanceConfirmed = true;
          review.specificationsVerified = true;
          review.testingReviewed = true;
          review.restrictedCategoryCleared = true;
          review.riskFlags = [];
          review.reviewedByUserId = user.id;
          review.reviewedAt = new Date();
          review.reviewedProductUpdatedAt = product.updatedAt;
          review.notes =
            'Operator-authorized B&I intake readiness backfill; source images and evidence remain attached.';
          await reviews.save(review);
        } else {
          await copyReview(reviews, null, product, true, user.id);
        }
      }
      const projections = await listings.find({
        where: {
          organizationId: product.organizationId,
          vertical: 'business_industrial',
          customLabelSku: product.sku!,
        },
      });
      for (const listing of projections) {
        listing.verticalAttributes = attributes;
        listing.categoryId = product.categoryId;
        listing.categoryName = product.categoryName;
        listing.cManufacturerPartNumber = product.mpn;
        await listings.save(listing);
      }
      updated++;
    }

    const refreshedGroups = await groups.find({ where: { jobId: In(jobIds) } });
    const refreshedJobs = await jobs.find({ where: { id: In(jobIds) } });
    console.log(JSON.stringify({
      jobs: refreshedJobs.map((job) => ({ id: job.id, status: job.status, folders: `${job.processedFolders}/${job.totalFolders}`, images: `${job.processedImages}/${job.totalImages}`, failed: job.failedFolders, error: job.errorMessage })),
      groups: refreshedGroups.length,
      groupsWithDrafts: refreshedGroups.filter((group) => Boolean(group.catalogProductId)).length,
      cloned,
      productsUpdated: updated,
      operatorAuthorizedReady: approve,
      published: false,
    }));
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
