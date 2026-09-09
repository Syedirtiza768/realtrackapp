import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
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
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
  ) {}

  @Post('oauth/start')
  @RequirePermissions('business_industrial.access', 'business_industrial.stores.manage')
  @ApiOperation({ summary: 'Start an eBay OAuth connection for Business & Industrial' })
  async start(@Body() dto: EbayOAuthStartDto, @CurrentUser() user: User) {
    const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
    await this.businessIndustrial.assertEnabled();
    return this.oauth.startOAuth({
      userId: user.id,
      organizationId,
      internalStoreId: dto.internalStoreId ?? null,
      marketplaceId: dto.marketplaceId,
      environment: dto.environment,
      accountDisplayName: dto.accountDisplayName?.trim() || 'Business & Industrial eBay store',
      vertical: 'business_industrial',
    });
  }

  @Post('listings/validate')
  @RequirePermissions('business_industrial.access', 'business_industrial.publish')
  @ApiOperation({ summary: 'Validate an approved Business & Industrial listing for eBay targets' })
  async validate(@Body() dto: EbayValidateDto, @CurrentUser() user: User) {
    const organizationId = await this.assertPublishable(
      dto.catalogProductId,
      dto.targets.map((target) => target.ebayAccountId),
      user,
      dto.organizationId,
    );
    return this.listings.validateTargets({ ...dto, organizationId });
  }

  @Post('listings/publish')
  @RequirePermissions('business_industrial.access', 'business_industrial.publish')
  @ApiOperation({ summary: 'Enqueue an approved Business & Industrial listing for eBay publish' })
  async publish(@Body() dto: EbayPublishJobDto, @CurrentUser() user: User) {
    const organizationId = await this.assertPublishable(
      dto.catalogProductId,
      dto.targets.map((target) => target.ebayAccountId),
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
  @RequirePermissions('business_industrial.access', 'business_industrial.publish')
  @ApiOperation({ summary: 'Enqueue approved Business & Industrial listings for eBay publish' })
  async publishBulk(@Body() dto: EbayBulkPublishJobDto, @CurrentUser() user: User) {
    const { organizationId } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
    const products = await this.productRepo.find({
      where: { organizationId, vertical: 'business_industrial', id: In(dto.listingIds) },
      select: ['id', 'verticalValidationStatus', 'manualReview'],
    });
    if (products.length !== dto.listingIds.length || products.some((product) => product.verticalValidationStatus !== 'approved' || product.manualReview)) {
      throw new BadRequestException('Every Business & Industrial listing must be approved and not quarantined before publishing');
    }
    for (const storeId of dto.storeIds) {
      await this.businessIndustrial.assertBusinessIndustrialStore(user, storeId, organizationId, 'operate');
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

  private async assertPublishable(productId: string, accountIds: string[], user: User, organizationId?: string) {
    const org = await this.permissions.resolveOrganization(user.id, organizationId);
    const product = await this.productRepo.findOne({ where: { id: productId, organizationId: org.organizationId, vertical: 'business_industrial' } });
    if (!product) throw new BadRequestException('Business & Industrial listing not found in this workspace');
    if (product.verticalValidationStatus !== 'approved' || product.manualReview) throw new BadRequestException('Business & Industrial review must be approved and the listing must not be quarantined before publishing');
    for (const accountId of accountIds) {
      const account = await this.accountRepo.findOne({ where: { id: accountId, organizationId: org.organizationId }, relations: ['primaryStore'] });
      if (!account?.primaryStore) throw new BadRequestException('Every eBay target must be a dedicated Business & Industrial seller store');
      await this.businessIndustrial.assertBusinessIndustrialStore(user, account.primaryStore.id, org.organizationId, 'operate');
    }
    return org.organizationId;
  }
}
