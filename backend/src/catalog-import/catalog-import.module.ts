import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogProduct } from './entities/catalog-product.entity.js';
import { CatalogImport } from './entities/catalog-import.entity.js';
import { CatalogImportRow } from './entities/catalog-import-row.entity.js';
import { ComplianceAuditLog } from './entities/compliance-audit-log.entity.js';
import { CatalogImportController } from './catalog-import.controller.js';
import { CatalogImportService } from './catalog-import.service.js';
import { CsvImportProcessor } from './processors/csv-import.processor.js';
import { DuplicateDetectionService } from './services/duplicate-detection.service.js';
import { EbayComplianceService } from './services/ebay-compliance.service.js';
import { ComplianceAuditService } from './services/compliance-audit.service.js';
import { ComplianceController } from './controllers/compliance.controller.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { OpenAiModule } from '../common/openai/openai.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogProduct,
      CatalogImport,
      CatalogImportRow,
      ComplianceAuditLog,
      ListingRecord,
    ]),
    BullModule.registerQueue({ name: 'catalog-import' }),
    OpenAiModule,
  ],
  controllers: [CatalogImportController, ComplianceController],
  providers: [
    CatalogImportService,
    CsvImportProcessor,
    DuplicateDetectionService,
    EbayComplianceService,
    ComplianceAuditService,
  ],
  exports: [CatalogImportService, DuplicateDetectionService, EbayComplianceService, ComplianceAuditService],
})
export class CatalogImportModule {}
