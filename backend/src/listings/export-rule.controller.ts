import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExportRuleService } from './export-rule.service.js';
import { CreateExportRuleDto, UpdateExportRuleDto } from './dto/export-rule.dto.js';
import type { ExportRule } from './entities/export-rule.entity.js';

@ApiTags('export-rules')
@Controller('api/export-rules')
export class ExportRuleController {
  constructor(private readonly service: ExportRuleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new export rule' })
  @ApiResponse({ status: 201, description: 'Rule created' })
  async create(@Body() dto: CreateExportRuleDto): Promise<ExportRule> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all export rules' })
  async findAll(): Promise<ExportRule[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an export rule by ID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExportRule> {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an export rule' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExportRuleDto,
  ): Promise<ExportRule> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an export rule' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a rule: find matching products and create offers' })
  @ApiResponse({ status: 200, description: 'Returns count of offers created' })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ offersCreated: number }> {
    const count = await this.service.executeRule(id);
    return { offersCreated: count };
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview matching products for a rule (dry run)' })
  async preview(@Param('id', ParseUUIDPipe) id: string) {
    const products = await this.service.findMatchingProducts(id);
    return {
      matchingProductCount: products.length,
      products: products.slice(0, 50).map((p) => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        brand: p.brand,
        retailPrice: p.retailPrice,
        condition: p.condition,
      })),
    };
  }
}
