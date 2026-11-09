import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  ApplySuggestionDto,
  ApproveListingDto,
  ComplianceConfigDto,
  CreateFashionBatchDto,
  RejectListingDto,
  ReviewQueueQueryDto,
} from './fashion-batch-publish.dto.js';
import { FashionBatchPublishService } from './fashion-batch-publish.service.js';
import type { FashionComplianceConfig } from './fashion-compliance.rules.js';

/**
 * Fashion "Publish next N" pipeline (global prefix → /api/fashion/batch-publish).
 * Live batches additionally need fashion.review + fashion.authenticity.review,
 * checked in the service because dry runs do not.
 */
@Controller('fashion/batch-publish')
@RequirePermissions('fashion.access')
export class FashionBatchPublishController {
  constructor(private readonly batches: FashionBatchPublishService) {}

  @Post('batches')
  @RequirePermissions('fashion.access', 'fashion.publish')
  create(@Body() dto: CreateFashionBatchDto, @CurrentUser() user: User) {
    return this.batches.createBatch(user, dto);
  }

  @Get('batches')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  list(@CurrentUser() user: User, @Query('organizationId') organizationId?: string) {
    return this.batches.listBatches(user, organizationId);
  }

  @Get('batches/:id')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.getBatch(user, id, organizationId);
  }

  @Get('batches/:id/report.csv')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="fashion-batch-report.csv"')
  report(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.reportCsv(user, id, organizationId);
  }

  @Post('items/:itemId/retry')
  @RequirePermissions('fashion.access', 'fashion.publish')
  retry(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.retryItem(user, itemId, organizationId);
  }

  @Get('review-queue')
  @RequirePermissions('fashion.access', 'fashion.authenticity.review')
  queue(@CurrentUser() user: User, @Query() q: ReviewQueueQueryDto) {
    return this.batches.reviewQueue(user, q.state ?? 'NEEDS_REVIEW', q.organizationId);
  }

  @Get('listings/:id')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  item(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.reviewItem(user, id, organizationId);
  }

  @Get('listings/:id/audit')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  audit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.auditLog(user, id, organizationId);
  }

  @Post('listings/:id/apply-suggestion')
  @RequirePermissions('fashion.access', 'fashion.listings.update', 'fashion.review')
  applySuggestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplySuggestionDto,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.applySuggestion(user, id, dto, organizationId);
  }

  @Post('listings/:id/reject-suggestion')
  @RequirePermissions('fashion.access', 'fashion.review')
  rejectSuggestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.rejectSuggestion(user, id, organizationId);
  }

  @Post('listings/:id/recheck')
  @RequirePermissions('fashion.access', 'fashion.review')
  recheck(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.recheck(user, id, organizationId);
  }

  @Post('listings/:id/approve')
  @RequirePermissions('fashion.access', 'fashion.review', 'fashion.authenticity.review')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveListingDto,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.approve(user, id, dto, organizationId);
  }

  @Post('listings/:id/reject')
  @RequirePermissions('fashion.access', 'fashion.review', 'fashion.authenticity.review')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectListingDto,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.reject(user, id, dto, organizationId);
  }

  @Get('compliance-config')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  getConfig(@CurrentUser() user: User, @Query('organizationId') organizationId?: string) {
    return this.batches.getConfig(user, organizationId);
  }

  @Put('compliance-config')
  @RequirePermissions('fashion.access', 'fashion.settings.manage')
  putConfig(
    @Body() dto: ComplianceConfigDto,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.batches.putConfig(
      user,
      dto.config as Partial<FashionComplianceConfig>,
      organizationId,
    );
  }
}
