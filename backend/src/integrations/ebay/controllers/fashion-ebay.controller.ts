import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
import { VerticalsService } from '../../../verticals/verticals.service.js';
import { FashionListingsService } from '../../../verticals/fashion-listings.service.js';
import { StoreAccessService } from '../../../channels/store-access.service.js';
import { EbayTaxonomyApiService } from '../../../channels/ebay/ebay-taxonomy-api.service.js';
import { EbaySellingMetadataService } from '../../../channels/ebay/ebay-selling-metadata.service.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { User } from '../../../auth/entities/user.entity.js';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator.js';
import { EbayOAuthStartDto, EbayPublishJobDto, EbayValidateDto } from '../dto/ebay-integrations.dto.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayIntegrationsOAuthService } from '../services/ebay-integrations-oauth.service.js';
import { EbayMultiStoreListingService } from '../services/ebay-multi-store-listing.service.js';
import { EbayIntegrationAccountService } from '../services/ebay-integration-account.service.js';
import { EbayPolicySyncService } from '../services/ebay-policy-sync.service.js';

@ApiTags('fashion-ebay')
@ApiBearerAuth()
@Controller('fashion/ebay')
@RequirePermissions('fashion.access')
export class FashionEbayController {
  constructor(
    private readonly oauth: EbayIntegrationsOAuthService,
    private readonly permissions: EbayIntegrationPermissionsService,
    private readonly listings: EbayMultiStoreListingService,
    private readonly verticals: VerticalsService,
    @InjectRepository(CatalogProduct) private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ConnectedEbayAccount) private readonly accountRepo: Repository<ConnectedEbayAccount>,
    private readonly fashion: FashionListingsService,
    private readonly storeAccess: StoreAccessService,
    private readonly accountsService: EbayIntegrationAccountService,
    private readonly policySync: EbayPolicySyncService,
    private readonly taxonomy: EbayTaxonomyApiService,
    private readonly sellingMetadata: EbaySellingMetadataService,
    @InjectRepository(EbayListingChannel) private readonly channelRepo: Repository<EbayListingChannel>,
  ) {}

  @Post('oauth/start')
  @RequirePermissions('fashion.access', 'fashion.stores.manage')
  async start(@Body() dto: EbayOAuthStartDto, @CurrentUser() user: User) {
    const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
    await this.verticals.assertFeatureEnabled();
    if (dto.internalStoreId) throw new BadRequestException('Fashion connections must create a dedicated seller store');
    return this.oauth.startOAuth({ userId: user.id, organizationId, internalStoreId: null, marketplaceId: dto.marketplaceId, environment: dto.environment, accountDisplayName: dto.accountDisplayName?.trim() || 'Fashion eBay store', vertical: 'fashion' });
  }

  @Get('accounts')
  @RequirePermissions('fashion.access', 'fashion.stores.view')
  async accounts(@CurrentUser() user: User, @Query('organizationId') organizationId?: string) {
    const org = await this.permissions.resolveOrganization(user.id, organizationId);
    const accessible = await this.storeAccess.getAccessibleStoreIds(user);
    const accounts = await this.accountRepo.find({ where: { organizationId: org.organizationId }, relations: ['primaryStore', 'marketplaces'] });
    return accounts.filter((account) => {
      if (!account.primaryStore || !accessible.has(account.primaryStoreId)) return false;
      const config = this.verticals.getStoreConfig(account.primaryStore);
      return config.enabledVerticals.length === 1 && config.enabledVerticals[0] === 'fashion';
    }).map((account) => ({
      id: account.id, accountName: account.accountDisplayName, ebayUsername: account.ebayUsername,
      accountDisplayName: account.accountDisplayName, primaryStoreId: account.primaryStoreId, connectionStatus: account.connectionStatus,
      status: account.connectionStatus, environment: account.environment, marketplaceId: account.primaryStore.ebayMarketplaceId,
      storeId: account.primaryStoreId, storeName: account.primaryStore.storeName,
      marketplaces: account.marketplaces.filter((mp) => mp.enabled).map((mp) => ({
        marketplaceId: mp.marketplaceId, defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
        defaultReturnPolicyId: mp.defaultReturnPolicyId, defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
        defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
      })),
    }));
  }

  @Get('accounts/:id/policies')
  @RequirePermissions('fashion.access', 'fashion.stores.view')
  async policies(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') organizationId?: string, @Query('marketplaceId') marketplaceId?: string) {
    const { org, account } = await this.authorizedAccount(user, id, organizationId);
    if (marketplaceId) this.marketplace(account, marketplaceId);
    const result = await this.accountsService.getPolicies(id, org.organizationId);
    return { policies: result.policies.filter((policy) => !marketplaceId || policy.marketplaceId === marketplaceId) };
  }

  @Post('accounts/:id/policies/sync')
  @RequirePermissions('fashion.access', 'fashion.stores.manage')
  async syncPolicies(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') organizationId?: string) {
    const { org } = await this.authorizedAccount(user, id, organizationId, 'admin');
    return this.policySync.syncPolicies(id, org.organizationId, user.id);
  }

  @Get('accounts/:id/categories')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  async categories(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('q') q: string, @Query('marketplaceId') marketplaceId?: string, @Query('organizationId') organizationId?: string) {
    const { account } = await this.authorizedAccount(user, id, organizationId);
    if (!q?.trim() || q.length > 200) throw new BadRequestException('Category search requires 1-200 characters');
    const marketplace = this.marketplace(account, marketplaceId);
    const tree = await this.taxonomy.getDefaultCategoryTreeId(marketplace);
    return this.taxonomy.getCategorySuggestions(q.trim(), tree);
  }

  @Get('accounts/:id/categories/:categoryId/metadata')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  async categoryMetadata(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Param('categoryId') categoryId: string, @Query('marketplaceId') marketplaceId?: string, @Query('organizationId') organizationId?: string) {
    const { account } = await this.authorizedAccount(user, id, organizationId);
    if (!/^\d{1,20}$/.test(categoryId)) throw new BadRequestException('Invalid eBay category ID');
    const marketplace = this.marketplace(account, marketplaceId);
    const tree = await this.taxonomy.getDefaultCategoryTreeId(marketplace);
    const [aspects, policies] = await Promise.all([
      this.taxonomy.getItemAspectsForCategory(categoryId, tree),
      this.sellingMetadata.getCategoryPolicies(account.primaryStoreId, marketplace, categoryId),
    ]);
    return { marketplaceId: marketplace, categoryId, aspects, ...policies };
  }

  @Post('listings/validate')
  @RequirePermissions('fashion.access', 'fashion.publish')
  async validate(@Body() dto: EbayValidateDto, @CurrentUser() user: User) {
    const organizationId = await this.assertPublishable(dto, user);
    return this.listings.validateTargets({ ...dto, organizationId });
  }

  @Post('listings/publish')
  @RequirePermissions('fashion.access', 'fashion.publish')
  async publish(@Body() dto: EbayPublishJobDto, @CurrentUser() user: User) {
    const organizationId = await this.assertPublishable(dto, user);
    const { job, skipped } = await this.listings.createPublishJob({ organizationId, requestedByUserId: user.id, catalogProductId: dto.catalogProductId, targets: dto.targets, idempotencyKey: dto.idempotencyKey });
    return { jobId: job.id, status: job.status, skippedTargets: skipped };
  }

  @Get('listing-jobs/:id')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  async getJob(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') organizationId?: string) {
    const { org, targets } = await this.authorizedJob(user, id, organizationId);
    const job = await this.listings.getJob(id, org.organizationId);
    return { id: job.id, jobId: job.id, jobType: job.jobType, status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt, targets };
  }

  @Get('listing-jobs/:id/targets')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  async getJobTargets(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') organizationId?: string) {
    return (await this.authorizedJob(user, id, organizationId)).targets;
  }

  @Get('listings')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  async channels(@CurrentUser() user: User, @Query('catalogProductId', new ParseUUIDPipe({ optional: true })) catalogProductId?: string, @Query('organizationId') organizationId?: string) {
    const org = await this.permissions.resolveOrganization(user.id, organizationId);
    const rows = await this.channelRepo.find({ where: { organizationId: org.organizationId, ...(catalogProductId ? { catalogProductId } : {}) }, relations: ['catalogProduct'], order: { updatedAt: 'DESC' }, take: 200 });
    const accessible = await this.storeAccess.getAccessibleStoreIds(user);
    const items: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (row.catalogProduct?.vertical !== 'fashion' || row.catalogProduct.organizationId !== org.organizationId) continue;
      try {
        const account = await this.fashion.account(row.ebayAccountId, org.organizationId);
        if (!accessible.has(account.primaryStoreId)) continue;
        items.push({ id: row.id, catalogProductId: row.catalogProductId, ebayAccountId: row.ebayAccountId, storeId: account.primaryStoreId, storeName: account.primaryStore.storeName, marketplaceId: row.marketplaceId, offerId: row.offerId, listingId: row.listingId, listingUrl: row.listingUrl, listingStatus: row.listingStatus, lastErrorMessage: row.lastErrorMessage, updatedAt: row.updatedAt });
      } catch (error) {
        if (!(error instanceof ForbiddenException || error instanceof NotFoundException)) throw error;
      }
    }
    return { items, total: items.length };
  }

  @Post('listings/:id/end')
  @RequirePermissions('fashion.access', 'fashion.publish')
  end(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') organizationId?: string) {
    return this.fashion.end(user, id, organizationId);
  }

  private async authorizedAccount(user: User, id: string, organizationId?: string, level: 'view' | 'operate' | 'admin' = 'view') {
    const org = await this.permissions.resolveOrganization(user.id, organizationId);
    const account = await this.fashion.account(id, org.organizationId);
    await this.storeAccess.assertStoreAccess(user, account.primaryStoreId, level);
    return { org, account };
  }

  private marketplace(account: ConnectedEbayAccount, requested?: string) {
    const marketplace = requested || account.primaryStore.ebayMarketplaceId;
    if (!marketplace || !account.marketplaces.some((mp) => mp.enabled && mp.marketplaceId === marketplace)) throw new BadRequestException('Marketplace is not enabled for this Fashion seller account');
    return marketplace;
  }

  private async assertPublishable(dto: EbayValidateDto, user: User) {
    const org = await this.permissions.resolveOrganization(user.id, dto.organizationId);
    await this.verticals.assertFeatureEnabled();
    await this.fashion.assertApproved(dto.catalogProductId, org.organizationId);
    if (!dto.targets.length || dto.targets.length > 20) throw new BadRequestException('Choose 1-20 Fashion publishing targets');
    for (const target of dto.targets) {
      const { account } = await this.authorizedAccount(user, target.ebayAccountId, org.organizationId, 'operate');
      this.marketplace(account, target.marketplaceId);
    }
    return org.organizationId;
  }

  private async authorizedJob(user: User, id: string, organizationId?: string) {
    const org = await this.permissions.resolveOrganization(user.id, organizationId);
    const targets = await this.listings.getJobTargets(id, org.organizationId);
    if (!targets.length) throw new NotFoundException('Fashion job not found');
    for (const target of targets) {
      if (!target.catalogProductId || !target.ebayAccountId || (target.vertical && target.vertical !== 'fashion')) throw new NotFoundException('Fashion job not found');
      if (!await this.productRepo.existsBy({ id: target.catalogProductId, organizationId: org.organizationId, vertical: 'fashion' })) throw new NotFoundException('Fashion job not found');
      await this.authorizedAccount(user, target.ebayAccountId, org.organizationId);
    }
    return { org, targets };
  }
}
