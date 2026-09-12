import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { FashionReview } from './entities/fashion-review.entity.js';
import { VerticalsService } from './verticals.service.js';
import { validateVerticalAttributes } from './vertical.config.js';
import {
  CreateFashionDraftDto,
  FashionReviewDto,
  UpdateFashionDraftDto,
} from './fashion.dto.js';

@Injectable()
export class FashionListingsService {
  constructor(
    private readonly db: DataSource,
    private readonly organizations: UserOrganizationService,
    private readonly stores: StoreAccessService,
    private readonly verticals: VerticalsService,
    private readonly inventory: EbayInventoryApiService,
  ) {}

  async detail(user: User, id: string, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.publicProduct(
      await this.product(this.db.manager, id, org.organizationId),
    );
  }

  async create(
    user: User,
    dto: CreateFashionDraftDto,
    organizationId?: string,
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    if (!dto.sku.trim() || !dto.title.trim())
      throw new ConflictException('SKU and title cannot be blank');
    const attributes = this.attributes(dto.verticalAttributes);
    try {
      return await this.db.transaction(async (manager) => {
        const repo = manager.getRepository(CatalogProduct);
        if (await repo.existsBy({ sku: dto.sku.trim() }))
          throw new ConflictException(
            'SKU already exists; current catalog requires globally unique SKUs',
          );
        const saved = await repo.save(
          repo.create({
            organizationId: org.organizationId,
            vertical: 'fashion',
            sku: dto.sku.trim(),
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            brand: dto.brand?.trim() || null,
            conditionId: dto.conditionId || null,
            price: dto.price ?? null,
            quantity: dto.quantity ?? 0,
            imageUrls: dto.imageUrls ?? [],
            categoryId: dto.categoryId || null,
            categoryName: dto.categoryName || null,
            verticalAttributes: attributes,
            verticalValidationStatus: 'draft',
            fitmentData: null,
            optimizationStatus: 'not_applicable',
            fitmentStatus: 'not_applicable',
          }),
        );
        await this.saveReview(manager, saved, null, {
          status: 'pending',
          authenticityConfirmed: false,
        });
        await this.audit(
          manager,
          saved,
          user.id,
          'fashion.draft.created',
          'success',
        );
        return this.publicProduct(saved);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException('SKU already exists');
      throw error;
    }
  }

  async update(
    user: User,
    id: string,
    dto: UpdateFashionDraftDto,
    organizationId?: string,
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.db.transaction(async (manager) => {
      const product = await this.product(manager, id, org.organizationId, true);
      const review = await this.assertMutable(manager, product);
      if (dto.sku !== undefined && dto.sku !== product.sku)
        throw new ConflictException('SKU is immutable');
      if (dto.title !== undefined && !dto.title.trim())
        throw new ConflictException('Title cannot be blank');
      const before = this.publicProduct(product);
      Object.assign(product, {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand.trim() || null } : {}),
        ...(dto.conditionId !== undefined
          ? { conditionId: dto.conditionId }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.imageUrls !== undefined ? { imageUrls: dto.imageUrls } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.categoryName !== undefined
          ? { categoryName: dto.categoryName }
          : {}),
        verticalAttributes: this.attributes(
          dto.verticalAttributes ?? product.verticalAttributes ?? {},
        ),
        verticalValidationStatus: 'needs_review',
      });
      await manager.getRepository(CatalogProduct).save(product);
      await this.saveReview(manager, product, review, {
        status: 'pending',
        authenticityConfirmed: false,
        reviewedByUserId: null,
        reviewedAt: null,
      });
      await this.audit(
        manager,
        product,
        user.id,
        'fashion.draft.updated',
        'success',
        before,
        this.publicProduct(product),
      );
      return this.publicProduct(product);
    });
  }

  async review(
    user: User,
    id: string,
    dto: FashionReviewDto,
    organizationId?: string,
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.db.transaction(async (manager) => {
      const product = await this.product(manager, id, org.organizationId, true);
      const previous = await this.assertMutable(manager, product);
      if (dto.decision === 'approved' && dto.authenticityConfirmed !== true)
        throw new ConflictException(
          'Explicit authenticity confirmation is required before approval',
        );
      // Evidence remains private. Do not infer confirmation from a checkbox default or AI output.
      const saved = await this.saveReview(manager, product, previous, {
        status: dto.decision,
        authenticityConfirmed: dto.authenticityConfirmed,
        evidenceKeys: dto.evidenceKeys ?? previous?.evidenceKeys ?? [],
        notes: dto.notes?.trim() || null,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      });
      product.verticalValidationStatus = dto.decision;
      await manager.getRepository(CatalogProduct).save(product);
      await this.audit(
        manager,
        product,
        user.id,
        'fashion.review.' + dto.decision,
        'success',
        { status: previous?.status ?? 'pending' },
        {
          status: saved.status,
          authenticityConfirmed: saved.authenticityConfirmed,
          evidenceCount: saved.evidenceKeys.length,
        },
      );
      return {
        listing: this.publicProduct(product),
        review: this.reviewSummary(saved),
      };
    });
  }

  async getReview(user: User, id: string, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    await this.product(this.db.manager, id, org.organizationId);
    const review = await this.db
      .getRepository(FashionReview)
      .findOneBy({ catalogProductId: id, organizationId: org.organizationId });
    // Legacy imports may not yet have a review row. A read never creates approval.
    return (
      review ?? {
        catalogProductId: id,
        organizationId: org.organizationId,
        status: 'pending',
        authenticityConfirmed: false,
        evidenceKeys: [],
        notes: null,
        reviewedByUserId: null,
        reviewedAt: null,
      }
    );
  }

  async quarantine(user: User, id: string, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    // Commit the local block BEFORE remote operations; network failures cannot roll it back.
    await this.db.transaction(async (manager) => {
      const product = await this.product(manager, id, org.organizationId, true);
      product.verticalValidationStatus = 'quarantined';
      product.manualReview = true;
      await manager.getRepository(CatalogProduct).save(product);
      const previous = await manager.getRepository(FashionReview).findOneBy({
        catalogProductId: id,
        organizationId: org.organizationId,
      });
      await this.saveReview(manager, product, previous, {
        status: 'quarantined',
        authenticityConfirmed: false,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      });
      await this.audit(
        manager,
        product,
        user.id,
        'fashion.quarantine',
        'blocked',
      );
    });
    const channels = await this.db.getRepository(EbayListingChannel).find({
      where: { catalogProductId: id, organizationId: org.organizationId },
    });
    const results = await Promise.all(
      channels.map(async (channel) => {
        try {
          // Incident permission authorizes containment of this workspace item across all its stores.
          return await this.withdraw(channel, org.organizationId, user.id);
        } catch {
          return {
            id: channel.id,
            status: 'failed',
            remoteRemovalVerified: false,
          };
        }
      }),
    );
    return {
      id,
      status: 'quarantined',
      remoteTakedown: !results.length
        ? 'no_tracked_publications'
        : results.every((result) => result.remoteRemovalVerified)
          ? 'verified'
          : 'incomplete',
      targets: results,
    };
  }

  async incidents(user: User, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const products = await this.db.getRepository(CatalogProduct).find({
      where: {
        organizationId: org.organizationId,
        vertical: 'fashion',
        verticalValidationStatus: 'quarantined',
      },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    return Promise.all(
      products.map(async (product) => ({
        ...this.publicProduct(product),
        targets: (
          await this.db.getRepository(EbayListingChannel).find({
            where: {
              catalogProductId: product.id,
              organizationId: org.organizationId,
            },
          })
        ).map((channel) => ({
          id: channel.id,
          ebayAccountId: channel.ebayAccountId,
          marketplaceId: channel.marketplaceId,
          status: channel.listingStatus,
          lastErrorMessage: channel.lastErrorMessage,
          remoteRemovalVerified:
            channel.listingStatus === 'ended' &&
            channel.lastSyncedAt !== null &&
            !channel.lastErrorCode,
        })),
      })),
    );
  }

  async end(user: User, channelId: string, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const channel = await this.db
      .getRepository(EbayListingChannel)
      .findOneBy({ id: channelId, organizationId: org.organizationId });
    if (!channel) throw new NotFoundException('Fashion publication not found');
    await this.product(
      this.db.manager,
      channel.catalogProductId,
      org.organizationId,
    );
    const account = await this.account(
      channel.ebayAccountId,
      org.organizationId,
    );
    await this.stores.assertStoreAccess(
      user,
      account.primaryStoreId,
      'operate',
    );
    return this.withdraw(channel, org.organizationId, user.id);
  }

  async account(id: string, organizationId: string) {
    const account = await this.db.getRepository(ConnectedEbayAccount).findOne({
      where: { id, organizationId },
      relations: ['primaryStore', 'marketplaces'],
    });
    if (!account?.primaryStore)
      throw new NotFoundException('Fashion eBay account not found');
    const config = this.verticals.getStoreConfig(account.primaryStore);
    if (
      config.enabledVerticals.length !== 1 ||
      config.enabledVerticals[0] !== 'fashion' ||
      (account.primaryStore.organizationId &&
        account.primaryStore.organizationId !== organizationId)
    )
      throw new ForbiddenException(
        'Seller store must belong exclusively to this Fashion workspace',
      );
    return account;
  }

  async containIfBlocked(channel: EbayListingChannel, userId: string | null) {
    try {
      await this.assertApproved(
        channel.catalogProductId,
        channel.organizationId,
      );
      return null;
    } catch (error) {
      if (
        !(
          error instanceof ConflictException ||
          error instanceof NotFoundException
        )
      )
        throw error;
      return this.withdraw(channel, channel.organizationId, userId);
    }
  }

  private async withdraw(
    channel: EbayListingChannel,
    organizationId: string,
    userId: string | null,
  ) {
    const product = await this.product(
      this.db.manager,
      channel.catalogProductId,
      organizationId,
    );
    try {
      const account = await this.account(channel.ebayAccountId, organizationId);
      if (channel.vertical && channel.vertical !== 'fashion')
        throw new ForbiddenException('Publication belongs to another vertical');
      if (!channel.offerId)
        throw new ConflictException(
          'No Inventory API offer ID; manual marketplace removal and reconciliation required',
        );
      await this.audit(
        this.db.manager,
        product,
        userId,
        'fashion.withdraw.attempt',
        'processing',
        undefined,
        { channelId: channel.id, offerId: channel.offerId },
      );
      const before = await this.inventory.getOffer(
        account.primaryStoreId,
        channel.offerId,
      );
      if (before.status?.toUpperCase() !== 'UNPUBLISHED')
        await this.inventory.withdrawOffer(
          account.primaryStoreId,
          channel.offerId,
        );
      const remote = await this.inventory.getOffer(
        account.primaryStoreId,
        channel.offerId,
      );
      if (remote.status?.toUpperCase() !== 'UNPUBLISHED')
        throw new ConflictException(
          'eBay has not confirmed that the offer is unpublished',
        );
      channel.listingStatus = 'ended';
      channel.lastSyncedAt = new Date();
      channel.lastErrorCode = null;
      channel.lastErrorMessage = null;
      await this.db.getRepository(EbayListingChannel).save(channel);
      await this.audit(
        this.db.manager,
        product,
        userId,
        'fashion.withdraw.verified',
        'success',
        undefined,
        { channelId: channel.id, offerId: channel.offerId },
      );
      return { id: channel.id, status: 'ended', remoteRemovalVerified: true };
    } catch (error) {
      channel.lastErrorCode = 'FASHION_WITHDRAW_UNVERIFIED';
      // Avoid copying credential-bearing upstream HTTP responses into public diagnostics.
      channel.lastErrorMessage =
        error instanceof ConflictException ||
        error instanceof ForbiddenException
          ? error.message
          : 'Withdrawal could not be verified. Check store authorization and retry the quarantine action.';
      await this.db.getRepository(EbayListingChannel).save(channel);
      await this.audit(
        this.db.manager,
        product,
        userId,
        'fashion.withdraw.failed',
        'failed',
        undefined,
        { channelId: channel.id, message: channel.lastErrorMessage },
      );
      return {
        id: channel.id,
        status: 'failed',
        remoteRemovalVerified: false,
        message: channel.lastErrorMessage,
      };
    }
  }

  async assertApproved(id: string, organizationId: string) {
    const product = await this.product(this.db.manager, id, organizationId);
    const review = await this.assertMutable(this.db.manager, product);
    if (
      product.verticalValidationStatus !== 'approved' ||
      review?.status !== 'approved' ||
      !review.authenticityConfirmed
    )
      throw new ConflictException(
        'Fashion review must be explicitly approved before publishing',
      );
    return product;
  }

  private async product(
    manager: EntityManager,
    id: string,
    organizationId: string,
    lock = false,
  ) {
    const product = await manager.getRepository(CatalogProduct).findOne({
      where: { id, organizationId, vertical: 'fashion' },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!product) throw new NotFoundException('Fashion listing not found');
    return product;
  }

  private async assertMutable(manager: EntityManager, product: CatalogProduct) {
    const reviews = await manager.getRepository(FashionReview).find({
      where: {
        catalogProductId: product.id,
        organizationId: product.organizationId!,
      },
    });
    if (
      product.manualReview ||
      product.verticalValidationStatus === 'quarantined' ||
      reviews.some((review) => review.status === 'quarantined')
    )
      throw new ForbiddenException(
        'Quarantined listings cannot be edited or approved; separate authorized incident resolution is required',
      );
    return reviews[0] ?? null;
  }

  private attributes(input: Record<string, unknown>) {
    const result = validateVerticalAttributes('fashion', input);
    if (result.errors.length) throw new ConflictException(result.errors);
    return result.attributes;
  }

  private async saveReview(
    manager: EntityManager,
    product: CatalogProduct,
    previous: FashionReview | null,
    patch: Partial<FashionReview>,
  ) {
    return manager.getRepository(FashionReview).save(
      manager.getRepository(FashionReview).create({
        organizationId: product.organizationId!,
        catalogProductId: product.id,
        evidenceKeys: [],
        notes: null,
        reviewedByUserId: null,
        reviewedAt: null,
        ...previous,
        ...patch,
      }),
    );
  }

  private async audit(
    manager: EntityManager,
    product: CatalogProduct,
    userId: string | null,
    action: string,
    result: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ) {
    await manager.getRepository(ListingActionLog).save({
      organizationId: product.organizationId!,
      catalogProductId: product.id,
      userId,
      action,
      result,
      beforeSnapshot: before ?? null,
      afterSnapshot: after ?? null,
    });
  }

  publicProduct(product: CatalogProduct) {
    return {
      id: product.id,
      sku: product.sku,
      title: product.title,
      description: product.description,
      brand: product.brand,
      conditionId: product.conditionId,
      price: product.price,
      quantity: product.quantity,
      imageUrls: product.imageUrls,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      vertical: product.vertical,
      verticalAttributes: product.verticalAttributes,
      verticalValidationStatus: product.verticalValidationStatus,
      manualReview: product.manualReview,
      updatedAt: product.updatedAt,
    };
  }

  private reviewSummary(review: FashionReview) {
    return {
      id: review.id,
      status: review.status,
      authenticityConfirmed: review.authenticityConfirmed,
      reviewedByUserId: review.reviewedByUserId,
      reviewedAt: review.reviewedAt,
      notes: review.notes,
      evidenceCount: review.evidenceKeys.length,
    };
  }
}
