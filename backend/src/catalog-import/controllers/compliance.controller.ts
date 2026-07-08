import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EbayComplianceService } from '../services/ebay-compliance.service.js';
import { ComplianceAuditService } from '../services/compliance-audit.service.js';

import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';

@ApiTags('Catalog Import / Compliance')
@Controller('catalog-import/compliance')
@RequirePermissions('catalog.compliance')
export class ComplianceController {
  constructor(
    private readonly complianceService: EbayComplianceService,
    private readonly auditService: ComplianceAuditService,
  ) {}

  @Post('validate-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a batch of products for eBay compliance' })
  async validateBatch(
    @Body() body: { productIds: string[]; autoFix?: boolean },
  ) {
    const { productIds, autoFix = true } = body;
    if (!productIds?.length) {
      return { error: 'productIds array is required' };
    }
    return this.complianceService.validateBatch(productIds, autoFix);
  }

  @Post('validate/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a single product for eBay compliance' })
  async validateProduct(
    @Param('productId') productId: string,
    @Query('autoFix') autoFix?: string,
  ) {
    const shouldAutoFix = autoFix !== 'false';
    return this.complianceService.validateProduct(productId, shouldAutoFix);
  }

  @Post('validate-import/:importId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate all products from a specific import for eBay compliance',
  })
  async validateImport(
    @Param('importId') importId: string,
    @Query('autoFix') autoFix?: string,
    @Query('limit') limit?: number,
  ) {
    const shouldAutoFix = autoFix !== 'false';
    const maxRecords = Math.min(limit || 500, 500);
    return this.complianceService.validateImportProducts(
      importId,
      shouldAutoFix,
      maxRecords,
    );
  }

  @Get('audit/:importId')
  @ApiOperation({ summary: 'Get compliance audit logs for an import' })
  async getImportAuditLogs(
    @Param('importId') importId: string,
    @Query('limit') limit?: number,
  ) {
    const logs = await this.auditService.getByImport(importId, limit ?? 500);
    const summary = await this.auditService.getImportAuditSummary(importId);
    return { logs, summary };
  }

  @Get('audit/product/:productId')
  @ApiOperation({ summary: 'Get compliance audit logs for a specific product' })
  async getProductAuditLogs(
    @Param('productId') productId: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getByProduct(productId, limit ?? 100);
  }
}
