"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var InventorySyncProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventorySyncProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const inventory_service_js_1 = require("../inventory.service.js");
const inventory_workbench_service_js_1 = require("../inventory-workbench.service.js");
const enrichment_retry_service_js_1 = require("../enrichment-retry.service.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const listing_optimization_service_js_1 = require("../../listing-optimization/listing-optimization.service.js");
let InventorySyncProcessor = InventorySyncProcessor_1 = class InventorySyncProcessor extends bullmq_1.WorkerHost {
    inventoryService;
    eventEmitter;
    workbench;
    retryService;
    listingOptimization;
    catalogProductRepo;
    logger = new common_1.Logger(InventorySyncProcessor_1.name);
    constructor(inventoryService, eventEmitter, workbench, retryService, listingOptimization, catalogProductRepo) {
        super();
        this.inventoryService = inventoryService;
        this.eventEmitter = eventEmitter;
        this.workbench = workbench;
        this.retryService = retryService;
        this.listingOptimization = listingOptimization;
        this.catalogProductRepo = catalogProductRepo;
    }
    async process(job) {
        switch (job.name) {
            case 'reconcile':
                await this.handleReconcile(job);
                break;
            case 'low-stock-alert':
                await this.handleLowStockAlert(job);
                break;
            case 'duplicate-scan':
                await this.handleDuplicateScan(job);
                break;
            case 'auto-enrich':
                await this.handleAutoEnrich(job);
                break;
            case 'enrichment-retry-scan':
                await this.handleEnrichmentRetryScan(job);
                break;
            default:
                this.logger.warn(`Unknown job type: ${job.name}`);
        }
    }
    async handleReconcile(job) {
        this.logger.log(`Running reconciliation for ${job.data.listingIds.length} listings`);
        const { results } = await this.inventoryService.reconcile(job.data.listingIds);
        const corrected = results.filter((r) => r.status === 'corrected').length;
        this.logger.log(`Reconciliation complete: ${corrected} corrections applied`);
    }
    async handleLowStockAlert(_job) {
        const items = await this.inventoryService.getLowStock(5, 100);
        if (items.length > 0) {
            this.logger.warn(`Low stock alert: ${items.length} items below threshold`);
            for (const item of items) {
                const available = (item.quantityTotal ?? 0) - (item.quantityReserved ?? 0);
                if (available <= 0) {
                    this.eventEmitter.emit('inventory.out_of_stock', {
                        listingId: item.listingId,
                        title: item.listing?.title ?? undefined,
                    });
                }
                else {
                    this.eventEmitter.emit('inventory.low_stock', {
                        listingId: item.listingId,
                        title: item.listing?.title ?? undefined,
                        available,
                        threshold: item.lowStockThreshold ?? 2,
                    });
                }
            }
        }
    }
    async handleDuplicateScan(_job) {
        const duplicates = await this.inventoryService.findDuplicates(0.7);
        this.logger.log(`Duplicate scan found ${duplicates.length} potential pairs`);
    }
    async handleAutoEnrich(job) {
        const { listingId, isAutoRetry } = job.data;
        const retryLabel = isAutoRetry ? 'auto-retry' : 'auto-enrich';
        this.logger.log(`${retryLabel}: starting inline enrichment for listing ${listingId}`);
        try {
            const { baseListing } = await this.workbench.inlineEnrichListing(listingId);
            await this.retryService.recordSuccess(listingId);
            this.logger.log(`${retryLabel}: inline enrichment completed for listing ${listingId}`);
            const sku = baseListing.customLabelSku?.trim();
            if (sku) {
                try {
                    const product = await this.catalogProductRepo.findOneBy({ sku });
                    if (product) {
                        await this.listingOptimization.optimizeProduct(product.id, 'US', {
                            force: false,
                        });
                    }
                }
                catch (optErr) {
                    this.logger.warn(`${retryLabel}: post-enrichment listing optimization failed for ${listingId} (sku=${sku}): ${optErr instanceof Error ? optErr.message : optErr}`);
                }
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`${retryLabel} failed for listing ${listingId}: ${message}`);
            const { shouldRetry, classification } = await this.retryService.recordFailure(listingId, err);
            if (shouldRetry) {
                this.logger.log(`${retryLabel}: listing ${listingId} classified as transient — ` +
                    `auto-retry scheduled (will be picked up by retry scanner)`);
            }
            else {
                this.logger.warn(`${retryLabel}: listing ${listingId} classified as ${classification} — ` +
                    `no further auto-retries`);
            }
            throw err;
        }
    }
    async handleEnrichmentRetryScan(_job) {
        const result = await this.retryService.enqueueDueRetries();
        if (result.scanned > 0) {
            this.logger.log(`Enrichment retry scan: ${result.scanned} due, ${result.enqueued} enqueued, ${result.skipped} skipped`);
        }
    }
};
exports.InventorySyncProcessor = InventorySyncProcessor;
exports.InventorySyncProcessor = InventorySyncProcessor = InventorySyncProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('inventory', { concurrency: 2 }),
    __param(5, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __metadata("design:paramtypes", [inventory_service_js_1.InventoryService,
        event_emitter_1.EventEmitter2,
        inventory_workbench_service_js_1.InventoryWorkbenchService,
        enrichment_retry_service_js_1.EnrichmentRetryService,
        listing_optimization_service_js_1.ListingOptimizationService,
        typeorm_2.Repository])
], InventorySyncProcessor);
//# sourceMappingURL=inventory-sync.processor.js.map