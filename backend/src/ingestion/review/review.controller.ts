import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewService } from './review.service.js';
import { ReviewDecisionDto } from '../dto/review-decision.dto.js';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { User } from '../../auth/entities/user.entity.js';

@ApiTags('Ingestion Review')
@Controller('ingestion/review')
@RequirePermissions('pipeline.review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @ApiOperation({ summary: 'List jobs needing human review' })
  async listForReview(@Query('limit') limit?: number) {
    const jobs = await this.reviewService.listForReview(limit ?? 20);
    return { jobs };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an ingestion job and create listing' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.reviewService.approve(id, dto, user.id);
    return result;
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an ingestion job' })
  async reject(
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: User,
  ) {
    const job = await this.reviewService.reject(id, dto, user.id);
    return { job };
  }
}
