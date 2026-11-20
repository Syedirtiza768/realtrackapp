import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryService } from '../inventory.service.js';
import { InventoryWorkbenchService } from '../inventory-workbench.service.js';
import { EnrichmentRetryService } from '../enrichment-retry.service.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ListingOptimizationService } from '../../listing-optimization/listing-optimization.service.js';
export declare class InventorySyncProcessor extends WorkerHost {
    private readonly inventoryService;
    private readonly eventEmitter;
    private readonly workbench;
    private readonly retryService;
    private readonly listingOptimization;
    private readonly catalogProductRepo;
    private readonly logger;
    constructor(inventoryService: InventoryService, eventEmitter: EventEmitter2, workbench: InventoryWorkbenchService, retryService: EnrichmentRetryService, listingOptimization: ListingOptimizationService, catalogProductRepo: Repository<CatalogProduct>);
    process(job: Job): Promise<void>;
    private handleReconcile;
    private handleLowStockAlert;
    private handleDuplicateScan;
    private handleAutoEnrich;
    private handleEnrichmentRetryScan;
}
