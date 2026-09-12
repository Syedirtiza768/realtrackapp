import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { ROLE_SLUGS } from '../rbac/permission-registry.js';
import { VerticalsService } from './verticals.service.js';
import {
  BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES,
  isRestrictedBusinessIndustrialFamily,
  validateBusinessIndustrialAttributes,
} from './business-industrial.config.js';
import { BusinessIndustrialIncident } from './entities/business-industrial-incident.entity.js';
import { BusinessIndustrialReview } from './entities/business-industrial-review.entity.js';
import { BusinessIndustrialUnit } from './entities/business-industrial-unit.entity.js';
import type {
  BusinessIndustrialIncidentDto,
  BusinessIndustrialReviewDto,
  BusinessIndustrialStoreAccessDto,
  BusinessIndustrialUnitDto,
  CreateBusinessIndustrialDraftDto,
  UpdateBusinessIndustrialDraftDto,
} from './business-industrial.dto.js';
import type {
  BusinessIndustrialUnitAllocationDto,
  BusinessIndustrialUnitSoldDto,
} from './business-industrial-units.dto.js';

const BI_VERTICAL = 'business_industrial' as const;
const BI_ROLES = new Set([
  ROLE_SLUGS.BUSINESS_INDUSTRIAL_ADMIN,
  ROLE_SLUGS.BUSINESS_INDUSTRIAL_MANAGER,
  ROLE_SLUGS.BUSINESS_INDUSTRIAL_OPERATOR,
]);

@Injectable()
export class BusinessIndustrialService {
  constructor(
    private readonly verticals: VerticalsService,
    private readonly userOrgs: UserOrganizationService,
    private readonly storeAccess: StoreAccessService,
    private readonly rbac: RbacService,
    private readonly events: EventEmitter2,
    private readonly inventory: EbayInventoryApiService,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(BusinessIndustrialReview)
    private readonly reviewRepo: Repository<BusinessIndustrialReview>,
    @InjectRepository(BusinessIndustrialUnit)
    private readonly unitRepo: Repository<BusinessIndustrialUnit>,
    @InjectRepository(BusinessIndustrialIncident)
    private readonly incidentRepo: Repository<BusinessIndustrialIncident>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async assertEnabled(): Promise<void> {
    await this.verticals.assertFeatureEnabled();
  }

  categoryFamilies() {
    return BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES;
  }

  resolveOrganization(user: User, organizationId?: string) {
    return this.userOrgs.resolveOrganizationId(user.id, organizationId);
  }

  async workspace(user: User, organizationId?: string) {
    await this.assertEnabled();
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const stores = await this.authorizedStores(user, org.organizationId);
    const [listingCount, draftCount, pendingReviewCount, incidentCount] =
      await Promise.all([
        this.productRepo.count({
          where: { organizationId: org.organizationId, vertical: BI_VERTICAL },
        }),
        this.productRepo.count({
          where: {
            organizationId: org.organizationId,
            vertical: BI_VERTICAL,
            verticalValidationStatus: In(['draft', 'needs_review']),
          },
        }),
        this.reviewRepo.count({
          where: { organizationId: org.organizationId, status: 'pending' },
        }),
        this.incidentRepo.count({
          where: {
            organizationId: org.organizationId,
            status: In([
              'received',
              'quarantined',
              'takedown_pending',
              'escalated',
            ]),
          },
        }),
      ]);
    return {
      organizationId: org.organizationId,
      organizationRole: org.member.role,
      categoryFamilies: BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES,
      stores: stores.map((store) => this.storeSummary(store)),
      metrics: {
        listingCount,
        draftCount,
        pendingReviewCount,
        openIncidentCount: incidentCount,
      },
    };
  }

  async listListings(user: User, organizationId?: string, limit = 50) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const products = await this.productRepo.find({
      where: { organizationId: org.organizationId, vertical: BI_VERTICAL },
      order: { updatedAt: 'DESC' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });
    return Promise.all(products.map((product) => this.publicProduct(product)));
  }

  async createListing(
    user: User,
    dto: CreateBusinessIndustrialDraftDto,
    organizationId?: string,
  ) {
    await this.assertEnabled();
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const sku = dto.sku.trim();
    const existing = await this.productRepo.findOne({
      where: { organizationId: org.organizationId, sku },
    });
    if (existing)
      throw new ConflictException(
        `SKU ${sku} already exists in this organization`,
      );
    const attributes = this.normalizeAttributes(dto.verticalAttributes, dto);
    this.assertUnitPayload(attributes, dto.units);
    const saved = await this.productRepo.save(
      this.productRepo.create({
        organizationId: org.organizationId,
        vertical: BI_VERTICAL,
        verticalAttributes: attributes,
        verticalValidationStatus: 'needs_review',
        sku,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        brand:
          dto.brand?.trim() ||
          (typeof attributes.manufacturer === 'string'
            ? attributes.manufacturer
            : null),
        mpn:
          dto.mpn?.trim() ||
          (typeof attributes.mpn === 'string' ? attributes.mpn : null),
        conditionId: dto.conditionId?.trim() || null,
        conditionLabel: dto.conditionLabel?.trim() || null,
        price: dto.price ?? null,
        quantity: dto.quantity ?? this.quantityFromAttributes(attributes),
        imageUrls: dto.imageUrls ?? [],
        categoryId: dto.categoryId?.trim() || null,
        categoryName: dto.categoryName?.trim() || null,
        fitmentData: null,
        optimizationStatus:
          dto.optimizedTitle || dto.optimizedDescription
            ? 'completed'
            : 'not_applicable',
        optimizedTitle: dto.optimizedTitle?.trim() || null,
        optimizedDescription: dto.optimizedDescription?.trim() || null,
        optimizationPayload: dto.optimizationPayload ?? null,
        seoScore: scoreAsRatio(dto.seoScore),
        readinessScore: scoreAsRatio(dto.readinessScore),
        optimizedAt:
          dto.optimizedTitle || dto.optimizedDescription ? new Date() : null,
        fitmentStatus: 'not_applicable',
        manualReview: false,
      }),
    );
    await this.saveUnits(org.organizationId, saved.id, attributes, dto.units);
    await this.ensurePendingReview(org.organizationId, saved);
    return this.publicProduct(saved);
  }

  async updateListing(
    user: User,
    id: string,
    dto: UpdateBusinessIndustrialDraftDto,
    organizationId?: string,
  ) {
    const product = await this.findProduct(user, id, organizationId);
    await this.assertMutable(product);
    const attributes = this.normalizeAttributes(
      dto.verticalAttributes === undefined
        ? product.verticalAttributes
        : { ...(product.verticalAttributes ?? {}), ...dto.verticalAttributes },
      dto,
    );
    this.assertUnitPayload(attributes, dto.units);
    Object.assign(product, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
      ...(dto.brand !== undefined ? { brand: dto.brand.trim() || null } : {}),
      ...(dto.mpn !== undefined ? { mpn: dto.mpn.trim() || null } : {}),
      ...(dto.conditionId !== undefined
        ? { conditionId: dto.conditionId.trim() || null }
        : {}),
      ...(dto.conditionLabel !== undefined
        ? { conditionLabel: dto.conditionLabel.trim() || null }
        : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.imageUrls !== undefined ? { imageUrls: dto.imageUrls } : {}),
      ...(dto.categoryId !== undefined
        ? { categoryId: dto.categoryId.trim() || null }
        : {}),
      ...(dto.categoryName !== undefined
        ? { categoryName: dto.categoryName.trim() || null }
        : {}),
      verticalAttributes: attributes,
      verticalValidationStatus: 'needs_review',
      manualReview: false,
    });
    const saved = await this.productRepo.save(product);
    if (dto.units !== undefined) {
      await this.unitRepo.delete({
        organizationId: product.organizationId!,
        catalogProductId: product.id,
      });
      await this.saveUnits(
        product.organizationId!,
        product.id,
        attributes,
        dto.units,
      );
    }
    await this.reviewRepo.update(
      { organizationId: product.organizationId!, catalogProductId: product.id },
      {
        status: 'pending',
        provenanceConfirmed: false,
        specificationsVerified: false,
        testingReviewed: false,
        restrictedCategoryCleared: false,
        reviewedByUserId: null,
        reviewedAt: null,
        reviewedProductUpdatedAt: null,
      },
    );
    return this.publicProduct(saved);
  }

  async reviewListing(
    user: User,
    id: string,
    dto: BusinessIndustrialReviewDto,
    organizationId?: string,
  ) {
    const product = await this.findProduct(user, id, organizationId);
    await this.assertMutable(product);
    const orgId = product.organizationId!;
    const attributes = validateBusinessIndustrialAttributes(
      product.verticalAttributes ?? {},
    );
    if (dto.decision === 'approved') {
      if (
        !dto.provenanceConfirmed ||
        !dto.specificationsVerified ||
        !dto.testingReviewed
      )
        throw new BadRequestException(
          'Approval requires provenance, specification, and testing confirmations',
        );
      if (
        isRestrictedBusinessIndustrialFamily(
          attributes.attributes.categoryFamily,
        ) &&
        !dto.restrictedCategoryCleared
      )
        throw new BadRequestException(
          'Restricted categories require explicit compliance clearance before approval',
        );
      if (dto.riskFlags?.length)
        throw new BadRequestException('Resolve all risk flags before approval');
      if (attributes.errors.length)
        throw new BadRequestException({
          message: 'Product attributes are invalid',
          errors: attributes.errors,
        });
      if (!product.categoryId?.trim())
        throw new BadRequestException(
          'An eBay leaf category is required before approval',
        );
    }
    const review = await this.reviewRepo.findOne({
      where: { organizationId: orgId, catalogProductId: product.id },
    });
    const savedReview = await this.reviewRepo.save(
      Object.assign(
        review ??
          this.reviewRepo.create({
            organizationId: orgId,
            catalogProductId: product.id,
          }),
        {
          status: dto.decision,
          provenanceConfirmed: dto.provenanceConfirmed,
          specificationsVerified: dto.specificationsVerified,
          testingReviewed: dto.testingReviewed,
          restrictedCategoryCleared: dto.restrictedCategoryCleared ?? false,
          evidenceKeys: dto.evidenceKeys ?? review?.evidenceKeys ?? [],
          riskFlags: dto.riskFlags ?? [],
          reviewedByUserId: user.id,
          notes: dto.notes?.trim() || null,
          reviewedAt: new Date(),
          reviewedProductUpdatedAt: product.updatedAt,
        },
      ),
    );
    product.verticalValidationStatus = dto.decision;
    product.manualReview = false;
    await this.productRepo.save(product);
    return {
      listing: await this.publicProduct(product),
      review: this.reviewSummary(savedReview),
    };
  }

  async listReviews(user: User, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const reviewCandidates = await this.productRepo.find({
      where: {
        organizationId: org.organizationId,
        vertical: BI_VERTICAL,
        verticalValidationStatus: In([
          'draft',
          'needs_review',
          'rejected',
          'quarantined',
        ]),
      },
      order: { updatedAt: 'ASC' },
      take: 200,
    });
    const existingReviews = await this.reviewRepo.find({
      where: { organizationId: org.organizationId },
    });
    const existingProductIds = new Set(
      existingReviews.map((review) => review.catalogProductId),
    );
    for (const product of reviewCandidates) {
      if (!existingProductIds.has(product.id))
        await this.ensurePendingReview(org.organizationId, product);
    }
    const reviews = await this.reviewRepo.find({
      where: {
        organizationId: org.organizationId,
        status: In(['pending', 'rejected', 'quarantined']),
      },
      order: { updatedAt: 'ASC' },
      take: 200,
    });
    const products = reviews.length
      ? await this.productRepo.find({
          where: {
            organizationId: org.organizationId,
            vertical: BI_VERTICAL,
            id: In(reviews.map((review) => review.catalogProductId)),
          },
        })
      : [];
    const byId = new Map(products.map((product) => [product.id, product]));
    return Promise.all(
      reviews.map(async (review) => ({
        ...this.reviewSummary(review),
        listing: byId.get(review.catalogProductId)
          ? await this.publicProduct(byId.get(review.catalogProductId)!)
          : null,
      })),
    );
  }

  async getPrivateReview(user: User, id: string, organizationId?: string) {
    const product = await this.findProduct(user, id, organizationId);
    const review = await this.reviewRepo.findOne({
      where: { organizationId: product.organizationId!, catalogProductId: id },
    });
    if (!review)
      throw new NotFoundException('Business & Industrial review not found');
    const units = await this.unitRepo.find({
      where: { organizationId: product.organizationId!, catalogProductId: id },
      order: { createdAt: 'ASC' },
    });
    return { review, units };
  }

  /** Atomically reserves one serialized physical unit for an authorized B&I store. */
  async allocateUnit(
    user: User,
    unitId: string,
    dto: BusinessIndustrialUnitAllocationDto,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const unit = await this.unitRepo.findOne({
      where: { id: unitId, organizationId: org.organizationId },
    });
    if (!unit)
      throw new NotFoundException('Business & Industrial unit not found');
    const product = await this.productRepo.findOne({
      where: {
        id: unit.catalogProductId,
        organizationId: org.organizationId,
        vertical: BI_VERTICAL,
      },
    });
    if (!product)
      throw new NotFoundException('Business & Industrial listing not found');
    if (product.verticalAttributes?.inventoryMode !== 'serialized')
      throw new BadRequestException(
        'Only serialized inventory can be allocated by physical unit',
      );
    await this.assertBusinessIndustrialStore(
      user,
      dto.storeId,
      org.organizationId,
      'operate',
    );
    const result = await this.unitRepo.update(
      { id: unitId, organizationId: org.organizationId, status: 'available' },
      {
        status: 'allocated',
        allocatedStoreId: dto.storeId,
        allocatedOfferId: dto.offerId?.trim() || null,
      },
    );
    if (!result.affected)
      throw new ConflictException(
        'Business & Industrial unit is no longer available',
      );
    const saved = await this.unitRepo.findOne({
      where: { id: unitId, organizationId: org.organizationId },
    });
    if (!saved)
      throw new NotFoundException(
        'Business & Industrial unit not found after allocation',
      );
    return this.unitPublic(saved);
  }

  /** Atomically marks an allocated physical unit sold, preventing duplicate sale transitions. */
  async markUnitSold(
    user: User,
    unitId: string,
    dto: BusinessIndustrialUnitSoldDto,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const unit = await this.unitRepo.findOne({
      where: { id: unitId, organizationId: org.organizationId },
    });
    if (!unit)
      throw new NotFoundException('Business & Industrial unit not found');
    if (!unit.allocatedStoreId)
      throw new ConflictException(
        'Only an allocated Business & Industrial unit can be marked sold',
      );
    await this.assertBusinessIndustrialStore(
      user,
      unit.allocatedStoreId,
      org.organizationId,
      'operate',
    );
    const where: Record<string, string> = {
      id: unitId,
      organizationId: org.organizationId,
      status: 'allocated',
    };
    if (dto.offerId?.trim()) where.allocatedOfferId = dto.offerId.trim();
    const result = await this.unitRepo.update(where, { status: 'sold' });
    if (!result.affected)
      throw new ConflictException(
        'Business & Industrial unit is no longer allocated or the offer does not match',
      );
    const saved = await this.unitRepo.findOne({
      where: { id: unitId, organizationId: org.organizationId },
    });
    if (!saved)
      throw new NotFoundException(
        'Business & Industrial unit not found after sale',
      );
    return this.unitPublic(saved);
  }

  async quarantine(
    user: User,
    id: string,
    organizationId?: string,
    note?: string,
  ) {
    const product = await this.findProduct(user, id, organizationId);
    const result = await this.applyLocalQuarantine(
      product,
      user.id,
      note ?? 'Manual Business & Industrial quarantine',
    );
    const channels = await this.channelRepo.find({
      where: {
        organizationId: product.organizationId!,
        catalogProductId: product.id,
        vertical: BI_VERTICAL,
      },
    });
    const targets = await Promise.all(
      channels.map((channel) => this.withdrawChannel(channel)),
    );
    this.events.emit('business-industrial.incident', {
      organizationId: product.organizationId,
      productId: product.id,
      status: 'quarantined',
    });
    return {
      ...result,
      remoteTakedown: !targets.length
        ? 'no_tracked_publications'
        : targets.every((target) => target.remoteRemovalVerified)
          ? 'verified'
          : 'incomplete',
      targets,
    };
  }

  async createIncident(
    user: User,
    dto: BusinessIndustrialIncidentDto,
    organizationId?: string,
  ) {
    if (!dto.verified)
      throw new BadRequestException(
        'Only verified enforcement signals may trigger quarantine',
      );
    const product = await this.findProduct(
      user,
      dto.catalogProductId,
      organizationId,
    );
    const orgId = product.organizationId!;
    const existing = await this.incidentRepo.findOne({
      where: {
        organizationId: orgId,
        externalEventId: dto.externalEventId.trim(),
      },
    });
    if (existing) return this.incidentSummary(existing);
    const channels = await this.channelRepo.find({
      where: {
        organizationId: orgId,
        catalogProductId: product.id,
        vertical: BI_VERTICAL,
        listingStatus: 'published',
      },
    });
    const incident = await this.incidentRepo.save(
      this.incidentRepo.create({
        organizationId: orgId,
        catalogProductId: product.id,
        externalEventId: dto.externalEventId.trim(),
        incidentType: dto.incidentType,
        status: channels.length ? 'takedown_pending' : 'takedown_complete',
        verified: true,
        eventOccurredAt: dto.eventOccurredAt
          ? new Date(dto.eventOccurredAt)
          : null,
        firstTakedownAttemptAt: channels.length ? new Date() : null,
        takedownCompletedAt: channels.length ? null : new Date(),
        eventPayload: dto.eventPayload ?? {},
        takedownAttempts: channels.map((channel) => ({
          channelId: channel.id,
          ebayAccountId: channel.ebayAccountId,
          offerId: channel.offerId,
          action: 'manual_end_listing_required',
        })),
        createdByUserId: user.id,
        notes: dto.notes?.trim() || null,
      }),
    );
    await this.applyLocalQuarantine(
      product,
      user.id,
      `Verified ${dto.incidentType} incident ${incident.id}`,
    );
    await this.finishIncidentTakedown(incident);
    this.events.emit('business-industrial.incident', {
      organizationId: orgId,
      productId: product.id,
      incidentId: incident.id,
      status: incident.status,
      notifyVerticalAdministrators: true,
    });
    return this.incidentSummary(incident);
  }

  /** Process a signed external enforcement signal without trusting webhook JSON for identity. */
  async processEnforcementWebhook(rawBody: Buffer, signature?: string) {
    const secret = process.env.EBAY_WEBHOOK_SECRET?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        'EBAY_WEBHOOK_SECRET is not configured',
      );
    if (!signature)
      throw new UnauthorizedException('eBay enforcement signature is required');
    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new UnauthorizedException('Invalid eBay enforcement signature');
    }

    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('payload must be an object');
      payload = parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid eBay enforcement JSON payload');
    }
    const notification =
      payload.notification && typeof payload.notification === 'object'
        ? (payload.notification as Record<string, unknown>)
        : payload;
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;
    const reference =
      text(notification.itemId) ??
      text(notification.offerId) ??
      text(notification.inventorySku) ??
      text(notification.sku);
    if (!reference)
      return {
        status: 'ignored',
        reason: 'No eBay item, offer, inventory SKU, or SKU reference',
      };

    const channel = await this.channelRepo
      .createQueryBuilder('channel')
      .where('channel.vertical = :vertical', { vertical: BI_VERTICAL })
      .andWhere(
        '(channel.listingId = :reference OR channel.offerId = :reference OR channel.ebayInventorySku = :reference OR channel.internalSku = :reference)',
        { reference },
      )
      .orderBy('channel.updatedAt', 'DESC')
      .getOne();
    if (!channel)
      return {
        status: 'ignored',
        reason: 'Reference is not mapped to a B&I channel',
      };

    const product = await this.productRepo.findOne({
      where: {
        id: channel.catalogProductId,
        organizationId: channel.organizationId,
        vertical: BI_VERTICAL,
      },
    });
    if (!product)
      return {
        status: 'ignored',
        reason: 'Mapped B&I product no longer exists',
      };
    const externalEventId = (
      text(notification.eventId) ??
      text(notification.notificationId) ??
      text(payload.eventId) ??
      `sha256:${createHash('sha256').update(rawBody).digest('hex')}`
    ).slice(0, 200);
    const existing = await this.incidentRepo.findOne({
      where: { organizationId: product.organizationId!, externalEventId },
    });
    if (existing)
      return { status: 'duplicate', incident: this.incidentSummary(existing) };

    const rawType =
      `${text(notification.type) ?? text(notification.eventType) ?? ''}`.toLowerCase();
    const incidentType = rawType.includes('counterfeit')
      ? 'counterfeit'
      : rawType.includes('intellectual') || rawType.includes('vero')
        ? 'intellectual_property'
        : rawType.includes('recall')
          ? 'recalled_product'
          : rawType.includes('safety')
            ? 'product_safety'
            : 'other';
    const published = channel.listingStatus === 'published';
    const incident = await this.incidentRepo.save(
      this.incidentRepo.create({
        organizationId: product.organizationId!,
        catalogProductId: product.id,
        externalEventId,
        incidentType,
        status: published ? 'takedown_pending' : 'takedown_complete',
        verified: true,
        eventOccurredAt: text(notification.occurredAt)
          ? new Date(text(notification.occurredAt)!)
          : null,
        firstTakedownAttemptAt: published ? new Date() : null,
        takedownCompletedAt: published ? null : new Date(),
        eventPayload: payload,
        takedownAttempts: published
          ? [
              {
                channelId: channel.id,
                ebayAccountId: channel.ebayAccountId,
                offerId: channel.offerId,
                listingId: channel.listingId,
                action: 'manual_end_listing_required',
              },
            ]
          : [],
        createdByUserId: null,
        notes: `Signed eBay enforcement notification received for ${reference}`,
      }),
    );
    await this.applyLocalQuarantine(
      product,
      null,
      `Signed eBay enforcement notification ${incident.id}`,
    );
    await this.finishIncidentTakedown(incident);
    this.events.emit('business-industrial.incident', {
      organizationId: product.organizationId,
      productId: product.id,
      incidentId: incident.id,
      status: incident.status,
      notifyVerticalAdministrators: true,
    });
    return {
      status: 'accepted',
      incident: this.incidentSummary(incident),
      remoteActionRequired: published,
    };
  }

  async listIncidents(user: User, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return (
      await this.incidentRepo.find({
        where: { organizationId: org.organizationId },
        order: { detectedAt: 'DESC' },
        take: 200,
      })
    ).map((incident) => this.incidentSummary(incident));
  }

  async retryIncidentTakedown(user: User, id: string, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const incident = await this.incidentRepo.findOne({
      where: { id, organizationId: org.organizationId },
    });
    if (!incident)
      throw new NotFoundException('Business & Industrial incident not found');
    if (incident.status === 'released')
      throw new BadRequestException(
        'Released incidents cannot be retaken down',
      );
    await this.finishIncidentTakedown(incident);
    return this.incidentSummary(incident);
  }

  async endListingChannel(
    user: User,
    channelId: string,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const channel = await this.channelRepo.findOne({
      where: {
        id: channelId,
        organizationId: org.organizationId,
        vertical: BI_VERTICAL,
      },
    });
    if (!channel)
      throw new NotFoundException(
        'Business & Industrial publication not found',
      );
    const product = await this.productRepo.findOne({
      where: {
        id: channel.catalogProductId,
        organizationId: org.organizationId,
        vertical: BI_VERTICAL,
      },
    });
    if (!product)
      throw new NotFoundException('Business & Industrial listing not found');
    const account = await this.accountRepo.findOne({
      where: { id: channel.ebayAccountId, organizationId: org.organizationId },
      relations: ['primaryStore'],
    });
    if (!account?.primaryStore)
      throw new NotFoundException(
        'Business & Industrial eBay account not found',
      );
    await this.assertBusinessIndustrialStore(
      user,
      account.primaryStoreId,
      org.organizationId,
      'operate',
    );
    return this.withdrawChannel(channel);
  }

  async releaseIncident(
    user: User,
    id: string,
    notes: string,
    organizationId?: string,
  ) {
    if (!notes?.trim())
      throw new BadRequestException('Documented release notes are required');
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const incident = await this.incidentRepo.findOne({
      where: { id, organizationId: org.organizationId },
    });
    if (!incident)
      throw new NotFoundException('Business & Industrial incident not found');
    if (incident.status !== 'takedown_complete')
      throw new BadRequestException(
        'Remote takedown must be verified before an incident can be released',
      );
    if (incident.catalogProductId) {
      const product = await this.productRepo.findOne({
        where: {
          id: incident.catalogProductId,
          organizationId: org.organizationId,
          vertical: BI_VERTICAL,
        },
      });
      if (product) {
        product.manualReview = false;
        product.verticalValidationStatus = 'needs_review';
        await this.productRepo.save(product);
        await this.reviewRepo.update(
          { organizationId: org.organizationId, catalogProductId: product.id },
          {
            status: 'pending',
            notes: notes.trim(),
            reviewedByUserId: user.id,
            reviewedAt: new Date(),
          },
        );
      }
    }
    incident.status = 'released';
    incident.notes = notes.trim();
    return this.incidentRepo.save(incident);
  }

  async authorizedStores(user: User, organizationId: string): Promise<Store[]> {
    const stores = await this.storeRepo.find({
      where: { organizationId },
      order: { isPrimary: 'DESC', storeName: 'ASC' },
    });
    const owned = stores.filter((store) =>
      this.isDedicatedBusinessIndustrialStore(store),
    );
    if (
      await this.rbac.userHasPermission(
        user.id,
        'business_industrial.stores.manage',
      )
    )
      return owned;
    const accessible = await this.storeAccess.getAccessibleStoreIds(user);
    return owned.filter((store) => accessible.has(store.id));
  }

  async assertBusinessIndustrialStore(
    user: User,
    storeId: string,
    organizationId: string,
    minLevel: 'view' | 'operate' | 'admin' = 'view',
  ) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, organizationId },
    });
    if (!store || !this.isDedicatedBusinessIndustrialStore(store))
      throw new NotFoundException('Business & Industrial store not found');
    if (
      !(await this.rbac.userHasPermission(
        user.id,
        'business_industrial.stores.manage',
      ))
    )
      await this.storeAccess.assertStoreAccess(user, storeId, minLevel);
    return store;
  }

  async listUsers(user: User, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const members = await this.memberRepo.find({
      where: { organizationId: org.organizationId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    const result: Array<Record<string, unknown>> = [];
    for (const member of members) {
      if (
        !(await this.rbac.userHasPermission(
          member.userId,
          'business_industrial.access',
        ))
      )
        continue;
      const profile = await this.rbac.getAuthProfile(member.user);
      result.push({
        userId: member.userId,
        email: member.user.email,
        name: member.user.name,
        organizationRole: member.role,
        roleSlug: profile.roleSlug,
        roleName: profile.roleName,
        active: member.user.active,
      });
    }
    return result;
  }

  async updateUserRole(
    actor: User,
    userId: string,
    role: string,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      actor.id,
      organizationId,
    );
    if (!BI_ROLES.has(role as never))
      throw new BadRequestException(
        'Only Business & Industrial roles may be assigned from this workspace',
      );
    const member = await this.memberRepo.findOne({
      where: { organizationId: org.organizationId, userId },
    });
    if (
      !member ||
      !(await this.rbac.userHasPermission(userId, 'business_industrial.access'))
    )
      throw new NotFoundException('Business & Industrial user not found');
    await this.rbac.assignPrimaryRole(userId, role);
    return { userId, roleSlug: role };
  }

  async deactivateUser(actor: User, userId: string, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      actor.id,
      organizationId,
    );
    const member = await this.memberRepo.findOne({
      where: { organizationId: org.organizationId, userId },
    });
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (
      !member ||
      !user ||
      !(await this.rbac.userHasPermission(userId, 'business_industrial.access'))
    )
      throw new NotFoundException('Business & Industrial user not found');
    user.active = false;
    await this.userRepo.save(user);
    return { userId, active: false };
  }

  async setUserStoreAccess(
    actor: User,
    userId: string,
    dto: BusinessIndustrialStoreAccessDto,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      actor.id,
      organizationId,
    );
    const member = await this.memberRepo.findOne({
      where: { organizationId: org.organizationId, userId },
    });
    if (!member)
      throw new NotFoundException('Business & Industrial user not found');
    await this.assertBusinessIndustrialStore(
      actor,
      dto.storeId,
      org.organizationId,
      'admin',
    );
    const assignments = await this.storeAccess.getUserAssignments(userId);
    const existing = assignments.find(
      (assignment) => assignment.storeId === dto.storeId,
    );
    if (existing) {
      existing.accessLevel = dto.accessLevel;
      await this.storeAccess.setAssignment(
        userId,
        dto.storeId,
        dto.accessLevel,
      );
    } else {
      await this.storeAccess.setAssignment(
        userId,
        dto.storeId,
        dto.accessLevel,
      );
    }
    return { userId, storeId: dto.storeId, accessLevel: dto.accessLevel };
  }

  private async findProduct(user: User, id: string, organizationId?: string) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const product = await this.productRepo.findOne({
      where: { id, organizationId: org.organizationId, vertical: BI_VERTICAL },
    });
    if (!product)
      throw new NotFoundException('Business & Industrial listing not found');
    return product;
  }

  private async assertMutable(product: CatalogProduct) {
    if (
      product.manualReview ||
      product.verticalValidationStatus === 'quarantined'
    ) {
      throw new ForbiddenException(
        'Quarantined Business & Industrial listings are locked until the incident is released',
      );
    }
    const review = await this.reviewRepo.findOne({
      where: {
        organizationId: product.organizationId!,
        catalogProductId: product.id,
      },
    });
    if (review?.status === 'quarantined') {
      throw new ForbiddenException(
        'Quarantined Business & Industrial listings are locked until the incident is released',
      );
    }
  }

  private normalizeAttributes(
    raw: unknown,
    dto: { manufacturer?: string; model?: string; mpn?: string },
  ) {
    const merged = {
      ...(raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {}),
      ...(dto.manufacturer ? { manufacturer: dto.manufacturer.trim() } : {}),
      ...(dto.model ? { model: dto.model.trim() } : {}),
      ...(dto.mpn ? { mpn: dto.mpn.trim() } : {}),
    };
    const validation = validateBusinessIndustrialAttributes(merged);
    if (!validation.attributes.categoryFamily)
      throw new BadRequestException(
        'Select a Business & Industrial category family; products are never classified by keywords alone',
      );
    if (validation.errors.length)
      throw new BadRequestException({
        message: 'Invalid Business & Industrial attributes',
        errors: validation.errors,
      });
    return validation.attributes;
  }

  private assertUnitPayload(
    attributes: Record<string, unknown>,
    units?: BusinessIndustrialUnitDto[],
  ) {
    const mode = attributes.inventoryMode;
    if (mode === 'serialized' && (!units || units.length === 0))
      throw new BadRequestException(
        'Serialized inventory requires one private serial record per physical unit',
      );
    if (mode !== 'serialized' && units?.length)
      throw new BadRequestException(
        'Serial records are only valid for serialized inventory',
      );
    const privateSerials = new Set<string>();
    const publicSerials = new Set<string>();
    for (const unit of units ?? []) {
      const privateSerial = unit.serialNumberPrivate.trim();
      if (privateSerials.has(privateSerial))
        throw new ConflictException(
          `Duplicate private serial number ${privateSerial} in request`,
        );
      privateSerials.add(privateSerial);
      const publicSerial = unit.serialNumberPublic?.trim();
      if (publicSerial && publicSerials.has(publicSerial))
        throw new ConflictException(
          `Duplicate public serial number ${publicSerial} in request`,
        );
      if (publicSerial) publicSerials.add(publicSerial);
    }
  }

  private quantityFromAttributes(attributes: Record<string, unknown>): number {
    const lots = Number(attributes.sellableLots ?? 0);
    return Number.isInteger(lots) && lots > 0 ? lots : 0;
  }

  private async saveUnits(
    organizationId: string,
    productId: string,
    attributes: Record<string, unknown>,
    units?: BusinessIndustrialUnitDto[],
  ) {
    if (!units?.length) return;
    if (
      attributes.totalPhysicalUnits !== undefined &&
      Number(attributes.totalPhysicalUnits) !== units.length
    )
      throw new BadRequestException(
        'Serialized unit count must equal totalPhysicalUnits',
      );
    try {
      await this.unitRepo.save(
        units.map((unit) =>
          this.unitRepo.create({
            organizationId,
            catalogProductId: productId,
            serialNumberPrivate: unit.serialNumberPrivate.trim(),
            serialNumberPublic: unit.serialNumberPublic?.trim() || null,
            status: 'available',
            allocatedStoreId: null,
            allocatedOfferId: null,
          }),
        ),
      );
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === '23505')
        throw new ConflictException(
          'A serial number is already registered in this organization',
        );
      throw error;
    }
  }

  private async ensurePendingReview(
    organizationId: string,
    product: CatalogProduct,
  ) {
    const existing = await this.reviewRepo.findOne({
      where: { organizationId, catalogProductId: product.id },
    });
    if (existing) return existing;
    return this.reviewRepo.save(
      this.reviewRepo.create({
        organizationId,
        catalogProductId: product.id,
        status: 'pending',
        provenanceConfirmed: false,
        specificationsVerified: false,
        testingReviewed: false,
        restrictedCategoryCleared: false,
        evidenceKeys: [],
        riskFlags: [],
        reviewedByUserId: null,
        notes: null,
        reviewedAt: null,
        reviewedProductUpdatedAt: null,
      }),
    );
  }

  private async applyLocalQuarantine(
    product: CatalogProduct,
    userId: string | null,
    note: string,
  ) {
    product.manualReview = true;
    product.verticalValidationStatus = 'quarantined';
    await this.productRepo.save(product);
    await this.reviewRepo.update(
      { organizationId: product.organizationId!, catalogProductId: product.id },
      {
        status: 'quarantined',
        reviewedByUserId: userId,
        notes: note,
        reviewedAt: new Date(),
      },
    );
    return {
      id: product.id,
      status: 'quarantined',
      localBlock: true,
      remoteTakedown: 'manual_action_required',
    };
  }

  private async finishIncidentTakedown(incident: BusinessIndustrialIncident) {
    const channels = await this.channelRepo.find({
      where: {
        organizationId: incident.organizationId,
        catalogProductId: incident.catalogProductId ?? undefined,
        vertical: BI_VERTICAL,
      },
    });
    incident.firstTakedownAttemptAt ??= new Date();
    if (!channels.length) {
      incident.status = 'takedown_complete';
      incident.takedownCompletedAt = new Date();
      await this.incidentRepo.save(incident);
      return incident;
    }
    const results = await Promise.all(
      channels.map((channel) => this.withdrawChannel(channel)),
    );
    const history = Array.isArray(incident.takedownAttempts)
      ? incident.takedownAttempts
      : [];
    incident.takedownAttempts = [
      ...history,
      ...results.map((result) => ({
        channelId: result.id,
        status: result.status,
        remoteRemovalVerified: result.remoteRemovalVerified,
        attemptedAt: new Date().toISOString(),
        ...(result.message ? { message: result.message } : {}),
      })),
    ];
    const complete = results.every((result) => result.remoteRemovalVerified);
    incident.status = complete ? 'takedown_complete' : 'escalated';
    incident.takedownCompletedAt = complete ? new Date() : null;
    await this.incidentRepo.save(incident);
    return incident;
  }

  private async withdrawChannel(channel: EbayListingChannel) {
    const account = await this.accountRepo.findOne({
      where: {
        id: channel.ebayAccountId,
        organizationId: channel.organizationId,
      },
      relations: ['primaryStore'],
    });
    const failed = {
      id: channel.id,
      status: 'failed',
      remoteRemovalVerified: false,
      message:
        'Withdrawal could not be verified. Check store authorization and retry the incident action.',
    };
    if (
      !account?.primaryStore ||
      channel.vertical !== BI_VERTICAL ||
      !this.isDedicatedBusinessIndustrialStore(account.primaryStore)
    )
      return failed;
    if (!channel.offerId) {
      channel.lastErrorCode = 'BI_WITHDRAW_MISSING_OFFER';
      channel.lastErrorMessage =
        'No Inventory API offer ID; manual marketplace removal and reconciliation required';
      await this.channelRepo.save(channel);
      return { ...failed, message: channel.lastErrorMessage };
    }
    try {
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
      await this.channelRepo.save(channel);
      return {
        id: channel.id,
        status: 'ended',
        remoteRemovalVerified: true,
        message: undefined,
      };
    } catch {
      channel.lastErrorCode = 'BI_WITHDRAW_UNVERIFIED';
      channel.lastErrorMessage = failed.message;
      await this.channelRepo.save(channel);
      return failed;
    }
  }

  private isDedicatedBusinessIndustrialStore(store: Store): boolean {
    const raw = store.verticalConfig ?? {};
    const enabled = Array.isArray(raw.enabledVerticals)
      ? raw.enabledVerticals
      : [];
    return (
      raw.ownerVertical === BI_VERTICAL &&
      enabled.includes(BI_VERTICAL) &&
      store.channel === 'ebay'
    );
  }

  private storeSummary(store: Store) {
    return {
      id: store.id,
      storeName: store.storeName,
      status: store.status,
      marketplaceId: store.ebayMarketplaceId,
      vertical: BI_VERTICAL,
    };
  }

  private async publicProduct(product: CatalogProduct) {
    const units = await this.unitRepo.find({
      where: {
        organizationId: product.organizationId!,
        catalogProductId: product.id,
      },
      order: { createdAt: 'ASC' },
    });
    return {
      id: product.id,
      sku: product.sku,
      title: product.title,
      description: product.description,
      brand: product.brand,
      mpn: product.mpn,
      conditionId: product.conditionId,
      conditionLabel: product.conditionLabel,
      price: product.price,
      quantity: product.quantity,
      imageUrls: product.imageUrls,
      optimizedTitle: product.optimizedTitle,
      optimizedDescription: product.optimizedDescription,
      optimizationPayload: product.optimizationPayload,
      seoScore: scoreAsPercentage(product.seoScore),
      readinessScore: scoreAsPercentage(product.readinessScore),
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      vertical: product.vertical,
      verticalAttributes: product.verticalAttributes,
      verticalValidationStatus: product.verticalValidationStatus,
      manualReview: product.manualReview,
      serializedUnitCount: units.length,
      publicSerialNumbers: units
        .map((unit) => unit.serialNumberPublic)
        .filter((serial): serial is string => Boolean(serial)),
      updatedAt: product.updatedAt,
    };
  }

  private unitPublic(unit: BusinessIndustrialUnit) {
    return {
      id: unit.id,
      catalogProductId: unit.catalogProductId,
      serialNumberPublic: unit.serialNumberPublic,
      status: unit.status,
      allocatedStoreId: unit.allocatedStoreId,
      allocatedOfferId: unit.allocatedOfferId,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }

  private reviewSummary(review: BusinessIndustrialReview) {
    return {
      id: review.id,
      status: review.status,
      provenanceConfirmed: review.provenanceConfirmed,
      specificationsVerified: review.specificationsVerified,
      testingReviewed: review.testingReviewed,
      restrictedCategoryCleared: review.restrictedCategoryCleared,
      reviewedByUserId: review.reviewedByUserId,
      reviewedAt: review.reviewedAt,
      notes: review.notes,
      evidenceCount: review.evidenceKeys.length,
      riskFlags: review.riskFlags,
    };
  }

  private incidentSummary(incident: BusinessIndustrialIncident) {
    return {
      id: incident.id,
      catalogProductId: incident.catalogProductId,
      externalEventId: incident.externalEventId,
      incidentType: incident.incidentType,
      status: incident.status,
      verified: incident.verified,
      detectedAt: incident.detectedAt,
      firstTakedownAttemptAt: incident.firstTakedownAttemptAt,
      takedownCompletedAt: incident.takedownCompletedAt,
      takedownAttempts: incident.takedownAttempts,
      remoteActionRequired:
        incident.status === 'takedown_pending' ||
        incident.status === 'escalated',
      notes: incident.notes,
    };
  }
}

function scoreAsRatio(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value)) / 100;
}

function scoreAsPercentage(value: number | null): number | null {
  if (value === null || !Number.isFinite(Number(value))) return null;
  return Number(value) * 100;
}
