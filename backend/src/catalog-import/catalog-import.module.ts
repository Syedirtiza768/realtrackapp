import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogProduct } from './entities/catalog-product.entity.js';
import { CatalogImport } from './entities/catalog-import.entity.js';
import { CatalogImportRow } from './entities/catalog-import-row.entity.js';
import { CatalogImportController } from './catalog-import.controller.js';
import { CatalogImportService } from './catalog-import.service.js';
import { CsvImportProcessor } from './processors/csv-import.processor.js';
import { DuplicateDetectionService } from './services/duplicate-detection.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogProduct, CatalogImport, CatalogImportRow]),
    BullModule.registerQueue({ name: 'catalog-import' }),
  ],
  controllers: [CatalogImportController],
  providers: [CatalogImportService, CsvImportProcessor, DuplicateDetectionService],
  exports: [CatalogImportService, DuplicateDetectionService],
})
export class CatalogImportModule {}
