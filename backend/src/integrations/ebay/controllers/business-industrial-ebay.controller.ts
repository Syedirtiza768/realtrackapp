import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { User } from '../../../auth/entities/user.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator.js';
import {
  EbayBulkPublishJobDto,
  EbayOAuthStartDto,
  EbayPublishJobDto,
  EbayValidateDto,
} from '../dto/ebay-integrations.dto.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayIntegrationsOAuthService } from '../services/ebay-integrations-oauth.service.js';
import { EbayMultiStoreListingService } from '../services/ebay-multi-store-listing.service.js';
import { BusinessIndustrialService } from '../../../verticals/business-industrial.service.js';
import { VerticalsService } from '../../../verticals/verticals.service.js';
import { EbayIntegrationAccountService } from '../services/ebay-integration-account.service.js';
import { EbayPolicySyncService } from '../services/ebay-policy-sync.service.js';
import { EbayTaxonomyApiService } from '../../../channels/ebay/ebay-taxonomy-api.service.js';
import { EbaySellingMetadataService } from '../../../channels/ebay/ebay-selling-metadata.service.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';

@ApiTags('business-industrial-ebay')
@ApiBearerAuth()
@Controller('business-industrial/ebay')
@RequirePermissions('business_industrial.access')
export class BusinessIndustrialEbayController {
  constructor(
    private readonly oauth: EbayIntegrationsOAuthService,
    private readonly permissions: EbayIntegrationPermissionsService,
    private readonly listings: EbayMultiStoreListingService,
    private readonly businessIndustrial: BusinessIndustrialService,
    private readonly verticals: VerticalsService,
    private readonly accountsService: EbayIntegrationAccountService,
    private readonly policySync: EbayPolicySyncService,
    private readonly taxonomy: EbayTaxonomyApiService,
    private readonly sellingMetadata: EbaySellingMetadataService,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
  ) {}

  @Post('oauth/start')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.stores.manage',
  )
  @ApiOperation({
    summary: 'Start an eBay OAuth connection for Business & Industrial',
  })
  async start(@Body() dto: EbayOAuthStartDto, @CurrentUser() user: User) {
    const { organizationId } = await this.permissions.resolveOrganization(
      user.id,
      dto.organizationId,
    );
    await this.businessIndustrial.assertEnabled();
    return this.oauth.startOAuth({
      userId: user.id,
      organizationId,
      internalStoreId: dto.internalStoreId ?? null,
      marketplaceId: dto.marketplaceId,
      environment: dto.environment,
      accountDisplayName:
        dto.accountDisplayName?.trim() || 'Business & Industrial eBay store',
      vertical: 'business_industrial',
    });
  }

  @Get('accounts')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.stores.view',
  )
  async accounts(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    const authorizedStores = await this.businessIndustrial.authorizedStores(
      user,
      org.organizationId,
    );
    const accessible = new Set(authorizedStores.map((store) => store.id));
    const accounts = await this.accountRepo.find({
      where: { organizationId: org.organizationId },
      relations: ['primaryStore', 'marketplaces'],
    });
    return accounts
      .filter((account) => {
        if (!account.primaryStore || !accessible.has(account.primaryStoreId))
          return false;
        const config = this.verticals.getStoreConfig(account.primaryStore);
        return (
          config.enabledVerticals.length === 1 &&
          config.enabledVerticals[0] === 'business_industrial'
        );
      })
      .map((account) => ({
        id: account.id,
        accountName: account.accountDisplayName,
        ebayUsername: account.ebayUsername,
        accountDisplayName: account.accountDisplayName,
        primaryStoreId: account.primaryStoreId,
        connectionStatus: account.connectionStatus,
        status: account.connectionStatus,
        environment: account.environment,
        marketplaceId: account.primaryStore.ebayMarketplaceId,
        storeId: account.primaryStoreId,
        storeName: account.primaryStore.storeName,
        marketplaces: account.marketplaces
          .filter((marketplace) => marketplace.enabled)
          .map((marketplace) => ({
            marketplaceId: marketplace.marketplaceId,
            defaultPaymentPolicyId: marketplace.defaultPaymentPolicyId,
            defaultReturnPolicyId: marketplace.defaultReturnPolicyId,
            defaultFulfillmentPolicyId: marketplace.defaultFulfillmentPolicyId,
            defaultInventoryLocationKey:
              marketplace.defaultInventoryLocationKey,
          })),
      }));
  }

  @Get('accounts/:id/policies')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.stores.view',
  )
  async policies(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
    @Query('marketplaceId') marketplaceId?: string,
  ) {
    const { org, account } = await this.authorizedAccount(
      user,
      id,
      organizationId,
    );
    if (marketplaceId) this.marketplace(account, marketplaceId);
    const result = await this.accountsService.getPolicies(
      id,
      org.organizationId,
    );
    return {
      policies: result.policies.filter(
        (policy) => !marketplaceId || policy.marketplaceId === marketplaceId,
      ),
    };
  }

  @Post('accounts/:id/policies/sync')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.stores.manage',
  )
  async syncPolicies(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const { org } = await this.authorizedAccount(
      user,
      id,
      organizationId,
      'admin',
    );
    return this.policySync.syncPolicies(id, org.organizationId, user.id);
  }

  @Get('accounts/:id/categories')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  async categories(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q: string,
    @Query('marketplaceId') marketplaceId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const { account } = await this.authorizedAccount(user, id, organizationId);
    if (!q?.trim() || q.length > 200)
      throw new BadRequestException(
        'Category search requires 1-200 characters',
      );
    const tree = await this.taxonomy.getDefaultCategoryTreeId(
      this.marketplace(account, marketplaceId),
    );
    return this.taxonomy.getCategorySuggestions(q.trim(), tree);
  }

  @Get('accounts/:id/categories/:categoryId/metadata')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  async categoryMetadata(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId') categoryId: string,
    @Query('marketplaceId') marketplaceId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const { account } = await this.authorizedAccount(user, id, organizationId);
    if (!/^\d{1,20}$/.test(categoryId))
      throw new BadRequestException('Invalid eBay category ID');
    const marketplace = this.marketplace(account, marketplaceId);
    const tree = await this.taxonomy.getDefaultCategoryTreeId(marketplace);
    const [aspects, policies] = await Promise.all([
      this.taxonomy.getItemAspectsForCategory(categoryId, tree),
      this.sellingMetadata.getCategoryPolicies(
        account.primaryStoreId,
        marketplace,
        categoryId,
      ),
    ]);
    return { marketplaceId: marketplace, categoryId, aspects, ...policies };
  }

  @Post('listings/validate')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.publish',
  )
  @ApiOperation({
    summary:
      'Validate an approved Business & Industrial listing for eBay targets',
  })
  async validate(@Body() dto: EbayValidateDto, @CurrentUser() user: User) {
    const organizationId = await this.assertPublishable(
      dto.catalogProductId,
      dto.targets,
      user,
      dto.organizationId,
    );
    return this.listings.validateTargets({ ...dto, organizationId });
  }

  @Post('listings/publish')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.publish',
  )
  @ApiOperation({
    summary:
      'Enqueue an approved Business & Industrial listing for eBay publish',
  })
  async publish(@Body() dto: EbayPublishJobDto, @CurrentUser() user: User) {
    const organizationId = await this.assertPublishable(
      dto.catalogProductId,
      dto.targets,
      user,
      dto.organizationId,
    );
    const { job, skipped } = await this.listings.createPublishJob({
      organizationId,
      requestedByUserId: user.id,
      catalogProductId: dto.catalogProductId,
      targets: dto.targets,
      idempotencyKey: dto.idempotencyKey,
    });
    return { jobId: job.id, status: job.status, skippedTargets: skipped };
  }

  @Post('listings/publish-bulk')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.publish',
  )
  @ApiOperation({
    summary: 'Enqueue approved Business & Industrial listings for eBay publish',
  })
  async publishBulk(
    @Body() dto: EbayBulkPublishJobDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId } = await this.permissions.resolveOrganization(
      user.id,
      dto.organizationId,
    );
    const products = await this.productRepo.find({
      where: {
        organizationId,
        vertical: 'business_industrial',
        id: In(dto.listingIds),
      },
      select: ['id', 'verticalValidationStatus', 'manualReview'],
    });
    if (
      products.length !== dto.listingIds.length ||
      products.some(
        (product) =>
          product.verticalValidationStatus !== 'approved' ||
          product.manualReview,
      )
    ) {
      throw new BadRequestException(
        'Every Business & Industrial listing must be approved and not quarantined before publishing',
      );
    }
    for (const storeId of dto.storeIds) {
      await this.businessIndustrial.assertBusinessIndustrialStore(
        user,
        storeId,
        organizationId,
        'operate',
      );
    }
    const result = await this.listings.createBulkPublishJob({
      organizationId,
      requestedByUserId: user.id,
      listingIds: dto.listingIds,
      storeIds: dto.storeIds,
      idempotencyKey: dto.idempotencyKey,
    });
    return {
      jobId: result.job.id,
      status: result.job.status,
      targetCount: result.targetCount,
      dailyLimit: result.dailyLimit,
      dailyUsed: result.dailyUsed,
      dailyRemaining: Math.max(0, result.dailyLimit - result.dailyUsed),
      skipped: result.skipped,
    };
  }

  @Get('listing-jobs/:id')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  async getJob(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const { org, targets } = await this.authorizedJob(user, id, organizationId);
    const job = await this.listings.getJob(id, org.organizationId);
    return {
      id: job.id,
      jobId: job.id,
      jobType: job.jobType,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      targets,
    };
  }

  @Get('listings')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  async channels(
    @CurrentUser() user: User,
    @Query('catalogProductId', new ParseUUIDPipe({ optional: true }))
    catalogProductId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    const rows = await this.channelRepo.find({
      where: {
        organizationId: org.organizationId,
        ...(catalogProductId ? { catalogProductId } : {}),
      },
      relations: ['catalogProduct'],
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    const authorizedStores = await this.businessIndustrial.authorizedStores(
      user,
      org.organizationId,
    );
    const accessible = new Set(authorizedStores.map((store) => store.id));
    const items: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (
        row.catalogProduct?.vertical !== 'business_industrial' ||
        row.catalogProduct.organizationId !== org.organizationId
      )
        continue;
      const account = await this.accountRepo.findOne({
        where: { id: row.ebayAccountId, organizationId: org.organizationId },
        relations: ['primaryStore'],
      });
      if (!account?.primaryStore || !accessible.has(account.primaryStoreId))
        continue;
      const config = this.verticals.getStoreConfig(account.primaryStore);
      if (
        config.enabledVerticals.length !== 1 ||
        config.enabledVerticals[0] !== 'business_industrial'
      )
        continue;
      items.push({
        id: row.id,
        catalogProductId: row.catalogProductId,
        ebayAccountId: row.ebayAccountId,
        storeId: account.primaryStoreId,
        storeName: account.primaryStore.storeName,
        marketplaceId: row.marketplaceId,
        offerId: row.offerId,
        listingId: row.listingId,
        listingUrl: row.listingUrl,
        listingStatus: row.listingStatus,
        lastErrorMessage: row.lastErrorMessage,
        updatedAt: row.updatedAt,
      });
    }
    return { items, total: items.length };
  }

  @Post('listings/:id/end')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.publish',
  )
  end(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.endListingChannel(user, id, organizationId);
  }

  private async assertPublishable(
    productId: string,
    targets: Array<{ ebayAccountId: string; marketplaceId: string }>,
    user: User,
    organizationId?: string,
  ) {
    const org = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    const product = await this.productRepo.findOne({
      where: {
        id: productId,
        organizationId: org.organizationId,
        vertical: 'business_industrial',
      },
    });
    if (!product)
      throw new BadRequestException(
        'Business & Industrial listing not found in this workspace',
      );
    if (product.verticalValidationStatus !== 'approved' || product.manualReview)
      throw new BadRequestException(
        'Business & Industrial review must be approved and the listing must not be quarantined before publishing',
      );
    if (!targets.length || targets.length > 20)
      throw new BadRequestException(
        'Choose 1-20 Business & Industrial publishing targets',
      );
    for (const target of targets) {
      const account = await this.accountRepo.findOne({
        where: { id: target.ebayAccountId, organizationId: org.organizationId },
        relations: ['primaryStore', 'marketplaces'],
      });
      if (!account?.primaryStore)
        throw new BadRequestException(
          'Every eBay target must be a dedicated Business & Industrial seller store',
        );
      await this.businessIndustrial.assertBusinessIndustrialStore(
        user,
        account.primaryStore.id,
        org.organizationId,
        'operate',
      );
      this.marketplace(account, target.marketplaceId);
    }
    return org.organizationId;
  }

  private async authorizedAccount(
    user: User,
    id: string,
    organizationId?: string,
    level: 'view' | 'operate' | 'admin' = 'view',
  ) {
    const org = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    const account = await this.accountRepo.findOne({
      where: { id, organizationId: org.organizationId },
      relations: ['primaryStore', 'marketplaces'],
    });
    if (!account?.primaryStore)
      throw new NotFoundException(
        'Business & Industrial eBay account not found',
      );
    const config = this.verticals.getStoreConfig(account.primaryStore);
    if (
      config.enabledVerticals.length !== 1 ||
      config.enabledVerticals[0] !== 'business_industrial'
    )
      throw new ForbiddenException(
        'Seller store must belong exclusively to the Business & Industrial workspace',
      );
    await this.businessIndustrial.assertBusinessIndustrialStore(
      user,
      account.primaryStoreId,
      org.organizationId,
      level,
    );
    return { org, account };
  }

  private marketplace(account: ConnectedEbayAccount, requested?: string) {
    const marketplace = requested || account.primaryStore.ebayMarketplaceId;
    if (
      !marketplace ||
      !account.marketplaces.some(
        (item) => item.enabled && item.marketplaceId === marketplace,
      )
    )
      throw new BadRequestException(
        'Marketplace is not enabled for this Business & Industrial seller account',
      );
    return marketplace;
  }

  private async authorizedJob(user: User, id: string, organizationId?: string) {
    const org = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    const targets = await this.listings.getJobTargets(id, org.organizationId);
    if (!targets.length)
      throw new NotFoundException('Business & Industrial job not found');
    for (const target of targets) {
      if (
        !target.catalogProductId ||
        !target.ebayAccountId ||
        (target.vertical && target.vertical !== 'business_industrial')
      )
        throw new NotFoundException('Business & Industrial job not found');
      if (
        !(await this.productRepo.existsBy({
          id: target.catalogProductId,
          organizationId: org.organizationId,
          vertical: 'business_industrial',
        }))
      )
        throw new NotFoundException('Business & Industrial job not found');
      await this.authorizedAccount(
        user,
        target.ebayAccountId,
        org.organizationId,
      );
    }
    return { org, targets };
  }
}
