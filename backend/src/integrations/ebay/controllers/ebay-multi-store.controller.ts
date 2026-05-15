import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayPublishJobDto, EbayValidateDto } from '../dto/ebay-integrations.dto.js';
import { EbayMultiStoreListingService } from '../services/ebay-multi-store-listing.service.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
import { EbayApiError } from '../entities/ebay-api-error.entity.js';
import { ListingActionLog } from '../entities/listing-action-log.entity.js';

@ApiTags('ebay-multi-store')
@Controller('ebay')
export class EbayMultiStoreController {
  constructor(
    private readonly listings: EbayMultiStoreListingService,
    private readonly permissions: EbayIntegrationPermissionsService,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
    @InjectRepository(EbayApiError)
    private readonly errorRepo: Repository<EbayApiError>,
    @InjectRepository(ListingActionLog)
    private readonly logRepo: Repository<ListingActionLog>,
  ) {}

  @Post('listings/validate')
  @ApiOperation({ summary: 'Validate catalog product for one or more eBay targets' })
  async validate(
    @Body() dto: EbayValidateDto,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, dto.organizationId);
    return this.listings.validateTargets(dto);
  }

  @Post('listings/publish')
  @ApiOperation({ summary: 'Enqueue multi-store publish job (one worker per target)' })
  async publish(
    @Body() dto: EbayPublishJobDto,
    @Headers('x-user-id') userId?: string,
  ) {
    const uid = dto.requestedByUserId ?? userId;
    if (!uid) return { error: 'requestedByUserId or x-user-id header required' };
    const member = await this.permissions.assertOrgMember(uid, dto.organizationId);
    this.permissions.assertCanPublish(member.role);
    const { job, skipped } = await this.listings.createPublishJob({
      organizationId: dto.organizationId,
      requestedByUserId: uid,
      catalogProductId: dto.catalogProductId,
      targets: dto.targets,
      idempotencyKey: dto.idempotencyKey,
    });
    return { jobId: job.id, status: job.status, skippedTargets: skipped };
  }

  @Get('listing-jobs/:id')
  @ApiOperation({ summary: 'Get listing job status' })
  async getJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    return this.listings.getJob(id, organizationId);
  }

  @Get('listing-jobs/:id/targets')
  @ApiOperation({ summary: 'List per-store targets for a job' })
  async getJobTargets(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    return this.listings.getJobTargets(id, organizationId);
  }

  @Get('listings')
  @ApiOperation({ summary: 'List eBay listing channels' })
  async listChannels(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('marketplaceId') marketplaceId?: string,
    @Query('status') status?: string,
    @Query('limit') limit = '50',
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    const qb = this.channelRepo
      .createQueryBuilder('c')
      .where('c.organizationId = :organizationId', { organizationId })
      .orderBy('c.updatedAt', 'DESC')
      .take(Math.min(Number(limit) || 50, 200));
    if (ebayAccountId) {
      qb.andWhere('c.ebayAccountId = :ebayAccountId', { ebayAccountId });
    }
    if (marketplaceId) {
      qb.andWhere('c.marketplaceId = :marketplaceId', { marketplaceId });
    }
    if (status) {
      qb.andWhere('c.listingStatus = :status', { status });
    }
    const [items, total] = await qb.getManyAndCount();
    return { total, items };
  }

  @Get('errors')
  @ApiOperation({ summary: 'List recent eBay API errors' })
  async listErrors(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
    @Query('limit') limit = '50',
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    const items = await this.errorRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.min(Number(limit) || 50, 200),
    });
    return { items };
  }

  @Get('activity-logs')
  @ApiOperation({ summary: 'Listing / integration activity logs' })
  async activity(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
    @Query('limit') limit = '100',
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    const items = await this.logRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.min(Number(limit) || 100, 500),
    });
    return { items };
  }
}
