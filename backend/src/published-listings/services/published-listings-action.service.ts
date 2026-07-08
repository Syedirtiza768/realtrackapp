import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { EbayInventoryApiService } from '../../channels/ebay/ebay-inventory-api.service.js';
import { EbayPublishService } from '../../channels/ebay/ebay-publish.service.js';
import { ListingActionLogWriterService } from '../../integrations/ebay/services/listing-action-log-writer.service.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import type {
  RevisePublishedListingDto,
  UpdatePoliciesDto,
} from '../dto/published-listings.dto.js';
import { PublishedListingsHealthService } from './published-listings-health.service.js';
import { PublishedListingsAuditService } from './published-listings-audit.service.js';
import { PublishedListingsSyncService } from './published-listings-sync.service.js';

@Injectable()
export class PublishedListingsActionService {
  private readonly logger = new Logger(PublishedListingsActionService.name);

  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly ebayPublish: EbayPublishService,
    private readonly health: PublishedListingsHealthService,
    private readonly audit: PublishedListingsAuditService,
    private readonly actionLog: ListingActionLogWriterService,
    private readonly sync: PublishedListingsSyncService,
  ) {}

  async revise(
    id: string,
    organizationId: string,
    user: User,
    dto: RevisePublishedListingDto,
  ): Promise<EbayPublishedListing> {
    const listing = await this.listingRepo.findOne({
      where: { id, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    if (!listing.sku) throw new BadRequestException('Listing has no SKU');

    const before = {
      title: listing.title,
      description: listing.description,
      price: listing.price,
      quantityAvailable: listing.quantityAvailable,
      imageUrls: listing.imageUrls,
      itemSpecifics: listing.itemSpecifics,
    };

    const storeId = listing.storeId;

    if (
      dto.title != null ||
      dto.description != null ||
      dto.imageUrls != null ||
      dto.itemSpecifics != null
    ) {
      const current = await this.inventoryApi.getItem(storeId, listing.sku);
      const updatedItem = {
        ...current,
        product: {
          ...current.product,
          ...(dto.title != null ? { title: dto.title } : {}),
          ...(dto.description != null ? { description: dto.description } : {}),
          ...(dto.imageUrls != null ? { imageUrls: dto.imageUrls } : {}),
          ...(dto.itemSpecifics != null ? { aspects: dto.itemSpecifics } : {}),
        },
      };
      await this.inventoryApi.createOrReplaceItem(
        storeId,
        listing.sku,
        updatedItem,
      );

      if (listing.offerId && dto.description != null) {
        await this.inventoryApi.updateOffer(storeId, listing.offerId, {
          listingDescription: dto.description,
        });
      }
    }

    if (dto.price != null || dto.quantity != null) {
      if (!listing.offerId) {
        throw new BadRequestException(
          'Listing has no offer ID for price/qty update',
        );
      }
      await this.inventoryApi.bulkUpdatePriceQuantity(storeId, [
        {
          offers: [
            {
              offerId: listing.offerId,
              ...(dto.price != null
                ? {
                    price: {
                      value: String(dto.price),
                      currency: listing.currency ?? 'USD',
                    },
                  }
                : {}),
              ...(dto.quantity != null
                ? { availableQuantity: dto.quantity }
                : {}),
            },
          ],
        },
      ]);
    }

    await this.sync.syncListingById(listing.id, organizationId);

    const refreshed = await this.listingRepo.findOneByOrFail({ id });

    await this.audit.writeRevision({
      organizationId,
      publishedListingId: listing.id,
      ebayAccountId: listing.ebayAccountId,
      userId: user.id,
      actionType: 'revise',
      ebayItemId: listing.ebayItemId,
      beforeValue: before,
      afterValue: {
        title: refreshed.title,
        description: refreshed.description,
        price: refreshed.price,
        quantityAvailable: refreshed.quantityAvailable,
        imageUrls: refreshed.imageUrls,
        itemSpecifics: refreshed.itemSpecifics,
      },
      apiResult: 'success',
    });

    await this.actionLog.write({
      organizationId,
      userId: user.id,
      ebayAccountId: listing.ebayAccountId,
      marketplaceId: listing.marketplaceId,
      action: 'published_listing.revise',
      beforeSnapshot: before,
      afterSnapshot: {
        title: refreshed.title,
        price: refreshed.price,
        quantityAvailable: refreshed.quantityAvailable,
      },
      result: 'success',
    });

    return refreshed;
  }

  /**
   * Update business policies (fulfillment / payment / return) on an
   * already-published eBay listing.
   *
   * Resolves profile names → eBay policy IDs, fetches the existing offer,
   * replaces its listingPolicies, and re-publishes so the change goes live.
   */
  async updatePolicies(
    id: string,
    organizationId: string,
    user: User,
    dto: UpdatePoliciesDto,
  ): Promise<EbayPublishedListing> {
    const listing = await this.listingRepo.findOne({
      where: { id, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    if (!listing.offerId) {
      throw new BadRequestException(
        'Listing has no offer ID — cannot update policies',
      );
    }

    const storeId = listing.storeId;
    const account = listing.ebayAccountId;
    const marketplaceId = listing.marketplaceId;

    // Resolve profile names → policy IDs using the synced business policy table
    const fulfillmentPolicyId =
      dto.fulfillmentPolicyId?.trim() ||
      (dto.shippingProfileName
        ? await this.ebayPublish.resolvePolicyByName(
            account,
            marketplaceId,
            'fulfillment',
            dto.shippingProfileName,
          )
        : undefined);

    const paymentPolicyId =
      dto.paymentPolicyId?.trim() ||
      (dto.paymentProfileName
        ? await this.ebayPublish.resolvePolicyByName(
            account,
            marketplaceId,
            'payment',
            dto.paymentProfileName,
          )
        : undefined);

    const returnPolicyId =
      dto.returnPolicyId?.trim() ||
      (dto.returnProfileName
        ? await this.ebayPublish.resolvePolicyByName(
            account,
            marketplaceId,
            'return',
            dto.returnProfileName,
            listing.categoryId ?? undefined,
            listing.condition ?? undefined,
          )
        : undefined);

    if (!fulfillmentPolicyId && !paymentPolicyId && !returnPolicyId) {
      throw new BadRequestException(
        'At least one policy ID or profile name must be provided',
      );
    }

    const before = listing.listingPolicies ?? {};

    // PUT replaces the entire offer, so fetch the existing offer first to
    // preserve pricing, category, quantity, etc.
    const existingOffer = await this.inventoryApi.getOffer(
      storeId,
      listing.offerId,
    );

    const newPolicies = {
      ...existingOffer.listingPolicies,
      ...(fulfillmentPolicyId ? { fulfillmentPolicyId } : {}),
      ...(paymentPolicyId ? { paymentPolicyId } : {}),
      ...(returnPolicyId ? { returnPolicyId } : {}),
    };

    await this.inventoryApi.updateOffer(storeId, listing.offerId, {
      ...existingOffer,
      listingPolicies: newPolicies,
    });

    // Re-publish the offer so the policy change goes live on eBay
    await this.inventoryApi.publishOffer(storeId, listing.offerId);

    this.logger.log(
      `Updated policies on ${listing.sku} (${listing.offerId}): ` +
        `fulfillment=${fulfillmentPolicyId ?? 'unchanged'}, ` +
        `payment=${paymentPolicyId ?? 'unchanged'}, ` +
        `return=${returnPolicyId ?? 'unchanged'}`,
    );

    // Sync the local record to pick up the updated listingPolicies
    await this.sync.syncListingById(listing.id, organizationId);

    const refreshed = await this.listingRepo.findOneByOrFail({ id });

    await this.audit.writeRevision({
      organizationId,
      publishedListingId: listing.id,
      ebayAccountId: listing.ebayAccountId,
      userId: user.id,
      actionType: 'revise',
      ebayItemId: listing.ebayItemId,
      beforeValue: { listingPolicies: before },
      afterValue: { listingPolicies: newPolicies },
      apiResult: 'success',
    });

    await this.actionLog.write({
      organizationId,
      userId: user.id,
      ebayAccountId: listing.ebayAccountId,
      marketplaceId: listing.marketplaceId,
      action: 'published_listing.update_policies',
      beforeSnapshot: { listingPolicies: before },
      afterSnapshot: { listingPolicies: newPolicies },
      result: 'success',
    });

    return refreshed;
  }

  async endListing(
    id: string,
    organizationId: string,
    user: User,
  ): Promise<EbayPublishedListing> {
    const listing = await this.listingRepo.findOne({
      where: { id, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    if (!listing.offerId) {
      throw new BadRequestException('Listing has no offer ID');
    }

    await this.inventoryApi.withdrawOffer(listing.storeId, listing.offerId);

    listing.listingStatus = 'ended';
    listing.lastSyncedAt = new Date();
    await this.listingRepo.save(listing);

    await this.audit.writeRevision({
      organizationId,
      publishedListingId: listing.id,
      ebayAccountId: listing.ebayAccountId,
      userId: user.id,
      actionType: 'end_listing',
      ebayItemId: listing.ebayItemId,
      beforeValue: { listingStatus: 'active' },
      afterValue: { listingStatus: 'ended' },
      apiResult: 'success',
    });

    await this.actionLog.write({
      organizationId,
      userId: user.id,
      ebayAccountId: listing.ebayAccountId,
      marketplaceId: listing.marketplaceId,
      action: 'published_listing.end',
      beforeSnapshot: { listingStatus: 'active' },
      afterSnapshot: { listingStatus: 'ended' },
      result: 'success',
    });

    return listing;
  }

  async relist(
    id: string,
    organizationId: string,
    user: User,
  ): Promise<EbayPublishedListing> {
    const listing = await this.listingRepo.findOne({
      where: { id, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    if (!listing.offerId) {
      throw new BadRequestException('Listing has no offer ID');
    }

    const result = await this.inventoryApi.publishOffer(
      listing.storeId,
      listing.offerId,
    );

    listing.ebayItemId = result.listingId ?? listing.ebayItemId;
    listing.listingStatus = 'active';
    listing.listingUrl = this.health.buildListingUrl(
      result.listingId,
      listing.marketplaceId,
      'production',
    );
    listing.lastSyncedAt = new Date();
    await this.listingRepo.save(listing);

    await this.audit.writeRevision({
      organizationId,
      publishedListingId: listing.id,
      ebayAccountId: listing.ebayAccountId,
      userId: user.id,
      actionType: 'relist',
      ebayItemId: listing.ebayItemId,
      beforeValue: { listingStatus: 'ended' },
      afterValue: { listingStatus: 'active', ebayItemId: result.listingId },
      apiResult: 'success',
    });

    return listing;
  }

  async refreshListing(
    id: string,
    organizationId: string,
    user: User,
  ): Promise<EbayPublishedListing> {
    const listing = await this.listingRepo.findOne({
      where: { id, organizationId },
    });
    if (!listing) throw new NotFoundException('Published listing not found');

    const { syncLogIds } = await this.sync.enqueueSync({
      organizationId,
      ebayAccountId: listing.ebayAccountId,
      userId: user.id,
      listingIds: [id],
    });

    if (syncLogIds.length) {
      await this.sync.syncAccount({
        organizationId,
        ebayAccountId: listing.ebayAccountId,
        userId: user.id,
        syncLogId: syncLogIds[0],
        listingIds: [id],
        trigger: 'single',
      });
    }

    return this.listingRepo.findOneByOrFail({ id });
  }
}
