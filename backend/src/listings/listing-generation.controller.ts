import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  ListingGenerationService,
  type GenerateListingInput,
  type GenerateAndPublishInput,
} from './listing-generation.service.js';

/* ── DTOs (inline — lightweight) ── */

class GenerateDto {
  masterProductId!: string;
  templateId?: string;
  storeId?: string;
  categoryName?: string;
}

class GenerateAndPublishDto {
  masterProductId!: string;
  templateId?: string;
  storeIds!: string[];
  categoryName?: string;
  publishImmediately?: boolean;
}

class GenerateBatchDto {
  items!: GenerateDto[];
}

/**
 * ListingGenerationController — AI-powered listing creation.
 *
 * Endpoints:
 *  POST /listings/generate         — Generate listing content for a single product
 *  POST /listings/generate-batch   — Generate listings for multiple products
 *  POST /listings/generate-publish — Generate + create offers + optionally publish
 */
@ApiTags('Listing Generation')
@Controller('listings')
export class ListingGenerationController {
  constructor(
    private readonly generationService: ListingGenerationService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI-optimized listing content for a master product' })
  generate(@Body() dto: GenerateDto) {
    const input: GenerateListingInput = {
      masterProductId: dto.masterProductId,
      templateId: dto.templateId,
      storeId: dto.storeId,
      categoryName: dto.categoryName,
    };
    return this.generationService.generate(input);
  }

  @Post('generate-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch generate listings for multiple products' })
  generateBatch(@Body() dto: GenerateBatchDto) {
    const inputs: GenerateListingInput[] = dto.items.map((item) => ({
      masterProductId: item.masterProductId,
      templateId: item.templateId,
      storeId: item.storeId,
      categoryName: item.categoryName,
    }));
    return this.generationService.generateBatch(inputs);
  }

  @Post('generate-publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate listing, create draft offers, and optionally publish to eBay' })
  generateAndPublish(@Body() dto: GenerateAndPublishDto) {
    const input: GenerateAndPublishInput = {
      masterProductId: dto.masterProductId,
      templateId: dto.templateId,
      storeIds: dto.storeIds,
      categoryName: dto.categoryName,
      publishImmediately: dto.publishImmediately,
    };
    return this.generationService.generateAndCreateOffers(input);
  }
}
