import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import * as express from 'express';
import { CatalogProductService } from './catalog-product.service.js';
import type { UpdateProductDto } from './catalog-product.service.js';
import { TemplateGeneratorService } from './template-generator.service.js';

@Controller('api/catalog-products')
export class CatalogProductController {
  constructor(
    private readonly productService: CatalogProductService,
    private readonly templateService: TemplateGeneratorService,
  ) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('pipelineJobId') pipelineJobId?: string,
    @Query('search') search?: string,
  ) {
    return this.productService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      pipelineJobId,
      search,
    });
  }

  @Patch('by-sku/:sku')
  async updateBySku(@Param('sku') sku: string, @Body() dto: Record<string, unknown>) {
    return this.productService.updateBySku(sku, dto);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.productService.update(id, dto);
  }

  @Post('export-templates')
  async exportTemplates(
    @Body() body: { ids?: string[]; listingIds?: string[]; formats?: ('us' | 'au' | 'de')[] },
    @Res() res: express.Response,
  ) {
    let products = body.ids?.length
      ? await this.productService.findByIds(body.ids)
      : [];

    // Also support listing record IDs — look up by SKU
    if (body.listingIds?.length && products.length === 0) {
      products = await this.productService.findByListingIds(body.listingIds);
    }

    if (!products.length) {
      res.status(404).json({ error: 'No catalog products found for given IDs' });
      return;
    }

    const formats = body.formats || ['us', 'au', 'de'];
    const zip = await this.templateService.generateTemplatesZip(products, formats);

    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="listings-${dateStr}.zip"`,
    });
    res.send(zip);
  }
}
