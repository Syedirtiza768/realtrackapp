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
import { CategoryLookupService } from './services/category-lookup.service.js';
import { ComplianceController } from './controllers/compliance.controller.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { OpenAiModule } from '../common/openai/openai.module.js';
import { CatalogProductController } from './catalog-product.controller.js';
import { CatalogProductService } from './catalog-product.service.js';
import { TemplateGeneratorService } from './template-generator.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { HeavyJobLimiterModule } from '../common/jobs/heavy-job-limiter.module.js';
import { ListingsModule } from '../listings/listings.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogProduct,
      CatalogImport,
      CatalogImportRow,
      ComplianceAuditLog,
      ListingRecord,
    ]),
    RbacModule,
    HeavyJobLimiterModule,
    BullModule.registerQueue({ name: 'catalog-import' }),
    OpenAiModule,
    StorageModule,
    ChannelsModule,
    ListingsModule,
  ],
  controllers: [
    CatalogImportController,
    ComplianceController,
    CatalogProductController,
  ],
  providers: [
    CatalogImportService,
    CsvImportProcessor,
    DuplicateDetectionService,
    EbayComplianceService,
    ComplianceAuditService,
    CatalogProductService,
    TemplateGeneratorService,
    CategoryLookupService,
  ],
  exports: [
    CatalogImportService,
    DuplicateDetectionService,
    EbayComplianceService,
    ComplianceAuditService,
    CatalogProductService,
    TemplateGeneratorService,
  ],
})
export class CatalogImportModule {}
