import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator.js';
import { EbayTaxonomyApiService } from './ebay-taxonomy-api.service.js';

@ApiTags('ebay-category')
@Controller('ebay/category')
export class EbayCategoryController {
  constructor(private readonly taxonomy: EbayTaxonomyApiService) {}

  @Get('suggest')
  @Public()
  @ApiOperation({ summary: 'Suggest eBay categories from a keyword query' })
  async suggest(@Query('q') q: string) {
    if (!q?.trim()) return { suggestions: [] };
    const suggestions = await this.taxonomy.getCategorySuggestions(q.trim());
    return {
      suggestions: suggestions.map((s) => ({
        id: s.category.categoryId,
        name: s.category.categoryName,
      })),
    };
  }
}
