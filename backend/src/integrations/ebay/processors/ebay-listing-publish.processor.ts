import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayListingJobTarget } from '../entities/ebay-listing-job-target.entity.js';
import { EbayListingJob } from '../entities/ebay-listing-job.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
import { EbayListingValidationService } from '../services/ebay-listing-validation.service.js';
import { ListingBuilderService } from '../services/listing-builder.service.js';
import { CatalogPublishResolverService } from '../services/catalog-publish-resolver.service.js';
import { EbayPublishService } from '../../../channels/ebay/ebay-publish.service.js';
import { Store } from '../../../channels/entities/store.entity.js';
import type { PublishErrorPayload } from '../../sellerpundit/sellerpundit.types.js';

class RetriablePublishError extends Error {}

function isTransientPublishFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    'product not found',
    'core inventory service internal error',
    'status code 500',
    'temporarily unavailable',
    'timed out',
    'timeout',
    'rate limit',
    'too many requests',
  ].some((marker) => normalized.includes(marker));
}

@Processor('ebay-listing-publish', { concurrency: 5 })
export class EbayListingPublishProcessor extends WorkerHost {
  private readonly logger = new Logger(EbayListingPublishProcessor.name);

  constructor(
    @InjectRepository(EbayListingJobTarget)
    private readonly targetRepo: Repository<EbayListingJobTarget>,
    @InjectRepository(EbayListingJob)
    private readonly jobRepo: Repository<EbayListingJob>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly validation: EbayListingValidationService,
    private readonly builder: ListingBuilderService,
    private readonly publishResolver: CatalogPublishResolverService,
    private readonly ebayPublish: EbayPublishService,
  ) {
    super();
  }

  async process(job: Job<{ targetId: string }>): Promise<void> {
    const target = await this.targetRepo.findOne({
      where: { id: job.data.targetId },
      relations: ['listingJob', 'ebayAccount'],
    });
    if (!target) {
      this.logger.warn(`Missing publish target ${job.data.targetId}`);
      return;
    }

    const listingJob = target.listingJob;
    const account = target.ebayAccount;

    if (!target.catalogProductId || !account) {
      await this.targetRepo.update(target.id, {
        status: 'failed',
        errorPayload: {
          source: 'internal',
          stage: 'precondition',
          message: !target.catalogProductId
            ? 'Catalog product was deleted before publish could run'
            : 'eBay account was disconnected before publish could run',
          errors: [
            !target.catalogProductId
              ? `catalogProductId is null for target ${target.id}`
              : `ebayAccountId ${target.ebayAccountId ?? 'null'} no longer exists`,
          ],
        } satisfies PublishErrorPayload,
      });
      await this.refreshJobStatus(listingJob.id);
      return;
    }

    const catalogProductId = target.catalogProductId;
    const ebayAccountId = target.ebayAccountId!;

    await this.jobRepo.update(listingJob.id, { status: 'processing' });

    await this.targetRepo.update(target.id, { status: 'processing' });

    try {
      const v = await this.validation.validatePublish({
        organizationId: listingJob.organizationId,
        catalogProductId,
        ebayAccountId,
        marketplaceId: target.marketplaceId,
      });

      if (v.status === 'blocked') {
        await this.targetRepo.update(target.id, {
          status: 'failed',
          errorPayload: {
            source: 'internal',
            stage: 'validation',
            message: 'Publish validation blocked',
            errors: v.errors,
            warnings: v.warnings,
          } satisfies PublishErrorPayload,
        });
        await this.refreshJobStatus(listingJob.id);
        return;
      }

      const store = await this.storeRepo.findOneBy({
        id: account.primaryStoreId,
      });
      if (!store) {
        await this.targetRepo.update(target.id, {
          status: 'failed',
          errorPayload: { message: 'Primary store missing' },
        });
        await this.refreshJobStatus(listingJob.id);
        return;
      }

      if (store.ebayMarketplaceId !== target.marketplaceId) {
        store.config = {
          ...(store.config ?? {}),
          marketplace: target.marketplaceId,
        };
        store.ebayMarketplaceId = target.marketplaceId;
        await this.storeRepo.save(store);
      }

      const resolved = await this.publishResolver.resolve(catalogProductId);
      const sourceListingId =
        typeof target.resultPayload?.sourceListingId === 'string'
          ? target.resultPayload.sourceListingId
          : undefined;
      const built = await this.builder.build({
        catalogProductId,
        sourceListingId,
        ebayAccountId,
        marketplaceId: target.marketplaceId,
        listingRecordId:
          sourceListingId ??
          resolved?.snapshot.listingRecordId ??
          catalogProductId,
        storeId: account.primaryStoreId,
      });

      if (built.blockingErrors.length) {
        await this.targetRepo.update(target.id, {
          status: 'failed',
          errorPayload: {
            source: 'internal',
            stage: 'build',
            message: 'Listing build failed',
            errors: built.blockingErrors,
          } satisfies PublishErrorPayload,
        });
        await this.refreshJobStatus(listingJob.id);
        return;
      }

      const results = await this.ebayPublish.publish(built.publishRequest);
      const r = results[0];
      if (r?.success) {
        await this.targetRepo.update(target.id, {
          status: 'success',
          resultPayload: {
            ...(target.resultPayload ?? {}),
            offerId: r.offerId,
            listingId: r.listingId,
            warnings: [...v.warnings, ...built.warnings],
          },
        });

        let ch = await this.channelRepo.findOne({
          where: {
            organizationId: listingJob.organizationId,
            catalogProductId,
            ebayAccountId,
            marketplaceId: target.marketplaceId,
          },
        });
        if (!ch) {
          ch = this.channelRepo.create({
            organizationId: listingJob.organizationId,
            catalogProductId,
            ebayAccountId,
            marketplaceId: target.marketplaceId,
          });
        }
        ch.internalSku = built.publishRequest.sku;
        ch.ebayInventorySku = built.publishRequest.sku;
        ch.offerId = r.offerId ?? null;
        ch.listingId = r.listingId ?? null;
        ch.listingUrl =
          r.listingId != null
            ? `https://www.ebay.com/itm/${r.listingId}`
            : null;
        ch.channelPrice = String(built.publishRequest.price);
        ch.channelQuantity = built.publishRequest.quantity;
        ch.listingStatus = 'published';
        ch.publishedAt = new Date();
        ch.lastErrorCode = null;
        ch.lastErrorMessage = null;
        await this.channelRepo.save(ch);
      } else {
        const message = r?.error ?? 'Publish failed';
        const maxAttempts = job.opts.attempts ?? 1;
        if (
          isTransientPublishFailure(message) &&
          job.attemptsMade + 1 < maxAttempts
        ) {
          await this.targetRepo.update(target.id, {
            status: 'pending',
            errorPayload: {
              source: 'ebay',
              stage: 'bulk_create',
              message,
              errors: [message],
            } satisfies PublishErrorPayload,
          });
          await this.refreshJobStatus(listingJob.id);
          throw new RetriablePublishError(message);
        }
        await this.targetRepo.update(target.id, {
          status: 'failed',
          errorPayload: {
            source: 'ebay',
            stage: 'bulk_create',
            message,
            errors: [message],
          } satisfies PublishErrorPayload,
        });
      }

      await this.refreshJobStatus(listingJob.id);
    } catch (err: unknown) {
      if (err instanceof RetriablePublishError) {
        this.logger.warn(
          `Publish target ${target.id} will retry after transient failure: ${err.message}`,
        );
        throw err;
      }
      this.logger.error(`Publish target ${target.id} crashed`, err);
      await this.targetRepo.update(target.id, {
        status: 'failed',
        errorPayload: {
          message: err instanceof Error ? err.message : String(err),
        },
      });
      await this.refreshJobStatus(listingJob.id);
      throw err;
    }
  }

  private async refreshJobStatus(jobId: string): Promise<void> {
    const targets = await this.targetRepo.find({
      where: { listingJobId: jobId },
    });
    const failed = targets.filter((t) => t.status === 'failed').length;
    const success = targets.filter((t) => t.status === 'success').length;
    const pending = targets.filter(
      (t) => t.status === 'pending' || t.status === 'processing',
    ).length;
    let status: EbayListingJob['status'] = 'processing';
    if (pending === 0) {
      if (failed && success) status = 'completed_with_errors';
      else if (failed) status = 'failed';
      else status = 'completed';
    }
    await this.jobRepo.update(jobId, { status });
  }
}
