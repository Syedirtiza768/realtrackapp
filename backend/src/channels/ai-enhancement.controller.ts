import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AiEnhancementService } from './ai-enhancement.service.js';
import {
  RequestEnhancementDto,
  BulkRequestEnhancementDto,
  ApproveEnhancementDto,
  RejectEnhancementDto,
  EnhancementQueryDto,
} from './dto/ai-enhancement.dto.js';

@ApiTags('ai-enhancements')
@Controller('ai-enhancements')
export class AiEnhancementController {
  constructor(private readonly aiService: AiEnhancementService) {}

  @Get()
  @ApiOperation({ summary: 'Query AI enhancements with filters' })
  getEnhancements(@Query() dto: EnhancementQueryDto) {
    return this.aiService.getEnhancements(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get AI enhancement statistics' })
  getStats() {
    return this.aiService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific AI enhancement' })
  getEnhancement(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.getEnhancement(id);
  }

  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get all AI enhancements for a listing' })
  getListingEnhancements(@Param('listingId') listingId: string) {
    return this.aiService.getListingEnhancements(listingId);
  }

  @Post('request')
  @ApiOperation({ summary: 'Request an AI enhancement for a listing' })
  requestEnhancement(@Body() dto: RequestEnhancementDto) {
    return this.aiService.requestEnhancement({
      listingId: dto.listingId,
      enhancementType: dto.enhancementType as any,
      inputData: dto.inputData,
    });
  }

  @Post('bulk-request')
  @ApiOperation({ summary: 'Request AI enhancements for multiple listings' })
  bulkRequest(@Body() dto: BulkRequestEnhancementDto) {
    return this.aiService.bulkRequestEnhancements(
      dto.listingIds,
      dto.enhancementType as any,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a generated AI enhancement' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveEnhancementDto,
  ) {
    return this.aiService.approveEnhancement(id, dto.approvedBy);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply an approved enhancement to the listing' })
  apply(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.applyEnhancement(id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a generated AI enhancement' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEnhancementDto,
  ) {
    return this.aiService.rejectEnhancement(id, dto.reason);
  }
}
