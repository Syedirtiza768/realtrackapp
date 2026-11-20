"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CsvImportProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsvImportProcessor = void 0;
exports.fashionSourceImageUrls = fashionSourceImageUrls;
exports.isRetryableFashionImageError = isRetryableFashionImageError;
exports.isRetryableCatalogImportError = isRetryableCatalogImportError;
exports.imageUrlsFromNumberedColumns = imageUrlsFromNumberedColumns;
exports.importUpdateWithoutBlankOverwrites = importUpdateWithoutBlankOverwrites;
const vertical_types_js_1 = require("../../verticals/vertical.types.js");
const vertical_config_js_1 = require("../../verticals/vertical.config.js");
const business_industrial_import_js_1 = require("../../verticals/business-industrial-import.js");
const business_industrial_config_js_1 = require("../../verticals/business-industrial.config.js");
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fashion_review_entity_js_1 = require("../../verticals/entities/fashion-review.entity.js");
const business_industrial_review_entity_js_1 = require("../../verticals/entities/business-industrial-review.entity.js");
const event_emitter_1 = require("@nestjs/event-emitter");
const fs = __importStar(require("fs"));
const catalog_import_entity_js_1 = require("../entities/catalog-import.entity.js");
const catalog_import_row_entity_js_1 = require("../entities/catalog-import-row.entity.js");
const catalog_product_entity_js_1 = require("../entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const extract_make_model_from_title_js_1 = require("../../listings/utils/extract-make-model-from-title.js");
const storage_service_js_1 = require("../../storage/storage.service.js");
const image_processor_service_js_1 = require("../../storage/image-processor.service.js");
const duplicate_detection_service_js_1 = require("../services/duplicate-detection.service.js");
const catalog_identifiers_js_1 = require("../utils/catalog-identifiers.js");
const ebay_compliance_service_js_1 = require("../services/ebay-compliance.service.js");
const category_lookup_service_js_1 = require("../services/category-lookup.service.js");
const ebay_browse_api_service_js_1 = require("../../channels/ebay/ebay-browse-api.service.js");
const ebay_listing_images_util_js_1 = require("../../channels/ebay/ebay-listing-images.util.js");
const fashion_catalog_export_js_1 = require("../../verticals/fashion-catalog-export.js");
const BATCH_SIZE = 250;
const PROGRESS_UPDATE_INTERVAL = 50;
const IMAGE_MIRROR_CONCURRENCY = 6;
const FASHION_IMAGE_CONCURRENCY = 2;
const FASHION_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
const FASHION_IMAGE_MAX_PIXEL_COUNT = 25_000_000;
const FASHION_IMAGE_RETRY_ATTEMPTS = 3;
const FASHION_IMAGE_RETRY_BASE_DELAY_MS = 1_000;
const FASHION_PENDING_IMAGE_BATCH_SIZE = 25;
const CATALOG_IMPORT_LOCAL_RETRY_ATTEMPTS = 5;
const CATALOG_IMPORT_LOCAL_RETRY_BASE_DELAY_MS = 1_000;
function fashionSourceImageUrls(product) {
    const persistedSourceUrls = product.verticalAttributes?._sourceImageUrls;
    const candidates = Array.isArray(persistedSourceUrls)
        ? persistedSourceUrls
        : typeof persistedSourceUrls === 'string'
            ? persistedSourceUrls.split('|')
            : product.imageUrls;
    return [
        ...new Set((candidates ?? [])
            .filter((url) => typeof url === 'string')
            .map((url) => url.trim())
            .filter((url) => /^https?:\/\//i.test(url))),
    ];
}
function isRetryableFashionImageError(error) {
    if (!error || typeof error !== 'object')
        return false;
    const candidate = error;
    const status = Number(candidate.status ??
        candidate.statusCode ??
        candidate.$metadata?.httpStatusCode);
    if (Number.isFinite(status) && status >= 400) {
        return status === 408 || status === 425 || status === 429 || status >= 500;
    }
    const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '';
    if ([
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'EAI_AGAIN',
        'ENOTFOUND',
        'ENETUNREACH',
        'EHOSTUNREACH',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_HEADERS_TIMEOUT',
        'UND_ERR_SOCKET',
    ].includes(code)) {
        return true;
    }
    const message = error instanceof Error
        ? error.message
        : typeof error.message === 'string'
            ? error.message
            : '';
    const statusMatch = message.match(/(?:HTTP|status)\s+(\d{3})/i);
    if (statusMatch) {
        const responseStatus = Number(statusMatch[1]);
        return (responseStatus === 408 ||
            responseStatus === 425 ||
            responseStatus === 429 ||
            responseStatus >= 500);
    }
    const name = typeof error.name === 'string'
        ? error.name
        : '';
    return /timeout|timed out|fetch failed|network|socket hang up|connection reset|connection (?:terminated|closed|timed out)|server closed the connection|could not connect|temporarily unavailable|resource temporarily unavailable|database system is starting up|rate limit|throttl/i.test(`${name} ${message}`);
}
function isRetryableCatalogImportError(error) {
    if (!error || typeof error !== 'object')
        return false;
    const candidate = error;
    const status = Number(candidate.status ??
        candidate.statusCode ??
        candidate.$metadata?.httpStatusCode);
    if (Number.isFinite(status) && status >= 400) {
        return status === 408 || status === 425 || status === 429 || status >= 500;
    }
    const rawCode = candidate.code ?? candidate.driverError?.code;
    const code = typeof rawCode === 'string' ? rawCode.toUpperCase() : '';
    if ([
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'EAI_AGAIN',
        'ENOTFOUND',
        'ENETUNREACH',
        'EHOSTUNREACH',
        '57P01',
        '57P02',
        '57P03',
        '40001',
        '40P01',
        '55P03',
        '53300',
    ].includes(code) ||
        code.startsWith('08')) {
        return true;
    }
    return isRetryableFashionImageError(error);
}
function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
const NUMBERED_IMAGE_HEADER = /^image_(?:url|\d+)$/i;
function imageUrlsFromNumberedColumns(headers, cells) {
    const urls = headers.flatMap((header, index) => {
        if (!NUMBERED_IMAGE_HEADER.test(header.trim()))
            return [];
        const url = cells[index]?.trim() ?? '';
        return /^https?:\/\//i.test(url) ? [url] : [];
    });
    return [...new Set(urls)].join('|');
}
function isEmptyImportValue(value) {
    return (value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0));
}
function importUpdateWithoutBlankOverwrites(update, existingAttributes) {
    const result = {};
    for (const [key, value] of Object.entries(update)) {
        if (key === 'verticalAttributes')
            continue;
        if (!isEmptyImportValue(value))
            result[key] = value;
    }
    const incoming = update
        .verticalAttributes;
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
        const merged = { ...(existingAttributes ?? {}) };
        for (const [key, value] of Object.entries(incoming)) {
            if (!isEmptyImportValue(value))
                merged[key] = value;
        }
        result.verticalAttributes = merged;
    }
    return result;
}
let CsvImportProcessor = CsvImportProcessor_1 = class CsvImportProcessor extends bullmq_1.WorkerHost {
    importRepo;
    rowRepo;
    productRepo;
    listingRepo;
    duplicateService;
    complianceService;
    dataSource;
    eventEmitter;
    storageService;
    imageProcessor;
    config;
    browseApi;
    categoryLookup;
    logger = new common_1.Logger(CsvImportProcessor_1.name);
    constructor(importRepo, rowRepo, productRepo, listingRepo, duplicateService, complianceService, dataSource, eventEmitter, storageService, imageProcessor, config, browseApi, categoryLookup) {
        super();
        this.importRepo = importRepo;
        this.rowRepo = rowRepo;
        this.productRepo = productRepo;
        this.listingRepo = listingRepo;
        this.duplicateService = duplicateService;
        this.complianceService = complianceService;
        this.dataSource = dataSource;
        this.eventEmitter = eventEmitter;
        this.storageService = storageService;
        this.imageProcessor = imageProcessor;
        this.config = config;
        this.browseApi = browseApi;
        this.categoryLookup = categoryLookup;
    }
    async process(job) {
        const queueAttempts = Math.max(1, Number(job.opts.attempts ?? 1));
        const localAttemptLimit = queueAttempts === 1 ? CATALOG_IMPORT_LOCAL_RETRY_ATTEMPTS : 1;
        for (let localAttempt = 1; localAttempt <= localAttemptLimit; localAttempt++) {
            try {
                await this.processAttempt(job, localAttempt, localAttemptLimit);
                return;
            }
            catch (error) {
                if (localAttempt >= localAttemptLimit ||
                    !isRetryableCatalogImportError(error)) {
                    throw error;
                }
                await wait(CATALOG_IMPORT_LOCAL_RETRY_BASE_DELAY_MS * 2 ** (localAttempt - 1));
            }
        }
    }
    async processAttempt(job, localAttempt, localAttemptLimit) {
        const { importId, filePath, columnMapping, resumeFromRow } = job.data;
        this.logger.log(`Processing CSV import ${importId} from row ${resumeFromRow}`);
        const importRecord = await this.importRepo.findOneBy({ id: importId });
        if (!importRecord || importRecord.status === 'cancelled') {
            this.logger.warn(`Import ${importId} was cancelled — aborting`);
            return;
        }
        await this.importRepo.update(importId, { status: 'processing' });
        const vertical = (0, vertical_types_js_1.normalizeProductVertical)(importRecord.vertical);
        const organizationId = importRecord.organizationId;
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const sanitizedContent = this.sanitizeCsvForLineSplit(fileContent);
            const lines = sanitizedContent
                .split(/\r?\n/)
                .filter((l) => l.trim().length > 0);
            const { headers, dataStartIdx } = this.findHeaders(lines);
            if (headers.length === 0) {
                throw new Error('Could not detect CSV headers');
            }
            const dataLines = lines.slice(dataStartIdx);
            const totalRows = dataLines.length;
            const listingSheetName = `Catalog Import ${importId}`;
            if (importRecord.totalRows !== totalRows) {
                await this.importRepo.update(importId, { totalRows });
            }
            const rowStatuses = await this.rowRepo.find({
                where: { importId },
                select: ['id', 'rowNumber', 'status', 'createdAt'],
                order: { createdAt: 'ASC', id: 'ASC' },
            });
            const latestStatusByRow = new Map();
            for (const row of rowStatuses)
                latestStatusByRow.set(row.rowNumber, row.status);
            let insertedRows = 0;
            let updatedRows = 0;
            let skippedDuplicates = 0;
            let flaggedForReview = 0;
            let invalidRows = 0;
            for (const status of latestStatusByRow.values()) {
                if (status === 'inserted')
                    insertedRows++;
                else if (status === 'updated')
                    updatedRows++;
                else if (status === 'duplicate_skipped')
                    skippedDuplicates++;
                else if (status === 'duplicate_flagged')
                    flaggedForReview++;
                else if (status === 'invalid')
                    invalidRows++;
            }
            const warnings = importRecord.warnings || [];
            const seenSku = new Set();
            const seenUpc = new Set();
            const seenEbayItemId = new Set();
            const alreadyInserted = await this.productRepo.find({
                where: { importId },
                select: ['sku', 'upc', 'ebayItemId'],
            });
            for (const p of alreadyInserted) {
                if (p.sku)
                    seenSku.add(this.normalizeIdentifier(p.sku));
                const seededUpc = (0, catalog_identifiers_js_1.normalizeCatalogUpc)(p.upc);
                if (seededUpc)
                    seenUpc.add(seededUpc);
                if (p.ebayItemId) {
                    seenEbayItemId.add(this.normalizeIdentifier(p.ebayItemId));
                }
            }
            const processedRowNumbers = new Set(latestStatusByRow.keys());
            let physicalCursor = Math.min(totalRows, Math.max(0, resumeFromRow, importRecord.lastProcessedRow || 0));
            let fitmentMergedLines = 0;
            let orphanFitmentLines = 0;
            if (vertical === 'fashion' && this.shouldMirrorCatalogImages()) {
                const shouldContinue = await this.retryPendingFashionImages(importRecord, listingSheetName, warnings);
                if (!shouldContinue)
                    return;
            }
            while (physicalCursor < totalRows) {
                const currentStatus = await this.importRepo.findOne({
                    where: { id: importId },
                    select: ['status'],
                });
                if (currentStatus?.status === 'cancelled') {
                    this.logger.warn(`Import ${importId} cancelled at physical line ${physicalCursor}`);
                    return;
                }
                const batchPrimaryRows = [];
                while (physicalCursor < totalRows &&
                    batchPrimaryRows.length < BATCH_SIZE) {
                    const pulled = vertical === 'automotive'
                        ? this.pullNextFileExchangeLogicalRow(dataLines, headers, columnMapping, physicalCursor)
                        : this.pullNextNonAutomotiveLogicalRow(dataLines, headers, columnMapping, physicalCursor);
                    physicalCursor = pulled.nextPhysicalIndex;
                    if (pulled.mergedFitmentLines > 0) {
                        fitmentMergedLines += pulled.mergedFitmentLines;
                    }
                    if (pulled.skippedOrphanFitment) {
                        orphanFitmentLines++;
                    }
                    if (pulled.primary) {
                        batchPrimaryRows.push(pulled.primary);
                    }
                }
                const parsedRows = batchPrimaryRows;
                const validRows = [];
                const importRowEntries = [];
                for (const row of parsedRows) {
                    if (processedRowNumbers.has(row.rowNumber)) {
                        continue;
                    }
                    const validation = this.validateRow(row.data);
                    if (!validation.valid) {
                        invalidRows++;
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'invalid',
                            message: validation.error,
                            rawData: row.data,
                        });
                    }
                    else {
                        if (vertical === 'business_industrial') {
                            const businessIndustrialValidation = (0, business_industrial_config_js_1.validateBusinessIndustrialAttributes)((0, business_industrial_import_js_1.businessIndustrialAttributesFromImportRow)(row.data));
                            if (businessIndustrialValidation.errors.length) {
                                invalidRows++;
                                const businessIndustrialMessage = `Business & Industrial validation failed: ${businessIndustrialValidation.errors.join('; ')}`;
                                importRowEntries.push({
                                    importId,
                                    rowNumber: row.rowNumber,
                                    status: 'invalid',
                                    message: businessIndustrialMessage,
                                    rawData: row.data,
                                });
                                if (warnings.length < 500)
                                    warnings.push(`Row ${row.rowNumber}: ${businessIndustrialMessage}`);
                                continue;
                            }
                            for (const warning of businessIndustrialValidation.warnings) {
                                if (warnings.length < 500)
                                    warnings.push(`Row ${row.rowNumber}: ${warning}`);
                            }
                        }
                        if (vertical === 'automotive') {
                            const compliance = this.complianceService.validateRowData(row.data);
                            if (!compliance.compliant) {
                                invalidRows++;
                                const complianceMsg = `eBay compliance failed: ${compliance.errors.join('; ')}`;
                                importRowEntries.push({
                                    importId,
                                    rowNumber: row.rowNumber,
                                    status: 'invalid',
                                    message: complianceMsg,
                                    rawData: row.data,
                                });
                                if (warnings.length < 500)
                                    warnings.push(`Row ${row.rowNumber}: ${complianceMsg}`);
                                continue;
                            }
                            for (const ac of compliance.autoCorrections) {
                                if (warnings.length < 500) {
                                    warnings.push(`Row ${row.rowNumber}: Auto-corrected ${ac.field}: "${ac.original}" → "${ac.corrected}"`);
                                }
                            }
                            for (const w of compliance.warnings) {
                                if (warnings.length < 500)
                                    warnings.push(`Row ${row.rowNumber}: [Compliance] ${w}`);
                            }
                        }
                        if (validation.warnings) {
                            for (const w of validation.warnings) {
                                const warnMsg = `Row ${row.rowNumber}: ${w}`;
                                if (warnings.length < 500)
                                    warnings.push(warnMsg);
                            }
                        }
                        validRows.push(row);
                    }
                }
                if (vertical === 'automotive') {
                    await this.enrichRowsFromEbayBrowse(validRows);
                    await this.enrichMissingCategories(validRows);
                }
                const uniqueRows = [];
                for (const row of validRows) {
                    const skuKey = row.data['sku']
                        ? this.normalizeIdentifier(row.data['sku'])
                        : null;
                    const upcKey = (0, catalog_identifiers_js_1.normalizeCatalogUpc)(row.data['upc']);
                    const ebayItemIdKey = row.data['ebayItemId']
                        ? this.normalizeIdentifier(row.data['ebayItemId'])
                        : null;
                    if (skuKey && seenSku.has(skuKey)) {
                        skippedDuplicates++;
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'duplicate_skipped',
                            matchStrategy: 'in_file_sku',
                            message: 'Duplicate SKU found in current import file',
                            rawData: row.data,
                        });
                        continue;
                    }
                    if (upcKey && seenUpc.has(upcKey)) {
                        skippedDuplicates++;
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'duplicate_skipped',
                            matchStrategy: 'in_file_upc',
                            message: 'Duplicate UPC found in current import file',
                            rawData: row.data,
                        });
                        continue;
                    }
                    if (ebayItemIdKey && seenEbayItemId.has(ebayItemIdKey)) {
                        skippedDuplicates++;
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'duplicate_skipped',
                            matchStrategy: 'in_file_ebay_item_id',
                            message: 'Duplicate eBay Item ID found in current import file',
                            rawData: row.data,
                        });
                        continue;
                    }
                    if (skuKey)
                        seenSku.add(skuKey);
                    if (upcKey)
                        seenUpc.add(upcKey);
                    if (ebayItemIdKey)
                        seenEbayItemId.add(ebayItemIdKey);
                    uniqueRows.push(row);
                }
                const dupCheckInputs = uniqueRows.map((row, idx) => ({
                    index: idx,
                    sku: row.data['sku'] || null,
                    mpn: row.data['mpn'] || null,
                    upc: (0, catalog_identifiers_js_1.normalizeCatalogUpc)(row.data['upc']),
                    title: row.data['title'] || null,
                    brand: row.data['brand'] || null,
                }));
                const dupResults = await this.duplicateService.checkDuplicateBatch(dupCheckInputs, { organizationId, vertical });
                const productsToInsert = [];
                const listingsToInsert = [];
                const productsToUpdate = [];
                const listingsToUpdate = [];
                for (let i = 0; i < uniqueRows.length; i++) {
                    const row = uniqueRows[i];
                    const dupResult = dupResults.get(i);
                    if (dupResult?.isDuplicate) {
                        const productUpdate = this.mapToProduct(row.data, importId, row.rowNumber, vertical, organizationId);
                        productsToUpdate.push({
                            product: productUpdate,
                            productId: dupResult.matchedProductId,
                        });
                        listingsToUpdate.push({
                            listing: this.mapToListingRecord(row.data, row.rowNumber, importRecord.fileName, filePath, listingSheetName, vertical, organizationId),
                            key: {
                                sourceFileName: importRecord.fileName,
                                sheetName: listingSheetName,
                                sourceRowNumber: row.rowNumber,
                            },
                        });
                        updatedRows++;
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'updated',
                            matchStrategy: dupResult.matchStrategy,
                            matchedProductId: dupResult.matchedProductId,
                            message: `Duplicate detected via ${dupResult.matchStrategy} — updating existing product`,
                            rawData: row.data,
                        });
                    }
                    else if (dupResult?.matchStrategy === duplicate_detection_service_js_1.UPC_OUTSIDE_SCOPE_STRATEGY) {
                        skippedDuplicates++;
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'duplicate_skipped',
                            matchStrategy: duplicate_detection_service_js_1.UPC_OUTSIDE_SCOPE_STRATEGY,
                            matchedProductId: dupResult.matchedProductId,
                            message: 'UPC already exists on a catalog product outside this organization/vertical; row not imported',
                            rawData: row.data,
                        });
                    }
                    else if (dupResult?.isPartialMatch) {
                        flaggedForReview++;
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'duplicate_flagged',
                            matchStrategy: dupResult.matchStrategy,
                            matchedProductId: dupResult.matchedProductId,
                            message: `Partial match via ${dupResult.matchStrategy} (confidence: ${dupResult.confidence})`,
                            rawData: row.data,
                        });
                    }
                    else {
                        const product = this.mapToProduct(row.data, importId, row.rowNumber, vertical, organizationId);
                        productsToInsert.push(product);
                        listingsToInsert.push(this.mapToListingRecord(row.data, row.rowNumber, importRecord.fileName, filePath, listingSheetName, vertical, organizationId));
                        importRowEntries.push({
                            importId,
                            rowNumber: row.rowNumber,
                            status: 'inserted',
                            rawData: row.data,
                        });
                    }
                }
                let savedBatchProducts = [];
                if (productsToInsert.length > 0 ||
                    productsToUpdate.length > 0 ||
                    importRowEntries.length > 0) {
                    await this.dataSource.transaction(async (manager) => {
                        if (productsToInsert.length > 0) {
                            savedBatchProducts = await manager
                                .getRepository(catalog_product_entity_js_1.CatalogProduct)
                                .save(productsToInsert);
                            if (vertical === 'fashion') {
                                for (const product of savedBatchProducts)
                                    await this.resetFashionReview(manager, product);
                            }
                            if (vertical === 'business_industrial') {
                                for (const product of savedBatchProducts)
                                    await this.resetBusinessIndustrialReview(manager, product);
                            }
                            await manager
                                .getRepository(listing_record_entity_js_1.ListingRecord)
                                .save(listingsToInsert);
                            let insertIdx = 0;
                            for (const entry of importRowEntries) {
                                if (entry.status === 'inserted' &&
                                    insertIdx < savedBatchProducts.length) {
                                    entry.createdProductId = savedBatchProducts[insertIdx].id;
                                    insertIdx++;
                                }
                            }
                        }
                        if (productsToUpdate.length > 0) {
                            const protectedRows = new Set();
                            for (const { product, productId } of productsToUpdate) {
                                let fashionExistingAttributes = null;
                                if (vertical === 'fashion') {
                                    const existing = await manager
                                        .getRepository(catalog_product_entity_js_1.CatalogProduct)
                                        .findOne({
                                        where: {
                                            id: productId,
                                            organizationId: organizationId,
                                            vertical: 'fashion',
                                        },
                                        lock: { mode: 'pessimistic_write' },
                                    });
                                    const review = existing
                                        ? await manager.getRepository(fashion_review_entity_js_1.FashionReview).findOneBy({
                                            catalogProductId: productId,
                                            organizationId: organizationId,
                                        })
                                        : null;
                                    if (!existing ||
                                        existing.manualReview ||
                                        existing.verticalValidationStatus === 'quarantined' ||
                                        review?.status === 'quarantined' ||
                                        review?.status === 'rejected') {
                                        protectedRows.add(product.sourceRow);
                                        const row = importRowEntries.find((entry) => entry.rowNumber === product.sourceRow);
                                        if (row) {
                                            row.status = 'duplicate_flagged';
                                            row.message =
                                                'Existing Fashion product is protected or unavailable; resolve its review before importing changes';
                                        }
                                        updatedRows--;
                                        flaggedForReview++;
                                        continue;
                                    }
                                    await this.resetFashionReview(manager, existing);
                                    fashionExistingAttributes =
                                        existing.verticalAttributes ?? {};
                                }
                                if (vertical === 'business_industrial') {
                                    const existing = await manager
                                        .getRepository(catalog_product_entity_js_1.CatalogProduct)
                                        .findOne({
                                        where: {
                                            id: productId,
                                            organizationId: organizationId,
                                            vertical: 'business_industrial',
                                        },
                                        lock: { mode: 'pessimistic_write' },
                                    });
                                    const review = existing
                                        ? await manager
                                            .getRepository(business_industrial_review_entity_js_1.BusinessIndustrialReview)
                                            .findOneBy({
                                            catalogProductId: productId,
                                            organizationId: organizationId,
                                        })
                                        : null;
                                    if (!existing ||
                                        existing.manualReview ||
                                        existing.verticalValidationStatus === 'quarantined' ||
                                        review?.status === 'quarantined' ||
                                        review?.status === 'rejected') {
                                        protectedRows.add(product.sourceRow);
                                        const row = importRowEntries.find((entry) => entry.rowNumber === product.sourceRow);
                                        if (row) {
                                            row.status = 'duplicate_flagged';
                                            row.message =
                                                'Existing Business & Industrial product is protected or unavailable; resolve its compliance incident before importing changes';
                                        }
                                        updatedRows--;
                                        flaggedForReview++;
                                        continue;
                                    }
                                    await this.resetBusinessIndustrialReview(manager, existing);
                                }
                                if (!product.upc)
                                    delete product.upc;
                                const update = vertical === 'fashion'
                                    ? importUpdateWithoutBlankOverwrites(product, fashionExistingAttributes)
                                    : product;
                                await manager
                                    .getRepository(catalog_product_entity_js_1.CatalogProduct)
                                    .update(productId, update);
                            }
                            for (const { listing, key } of listingsToUpdate) {
                                if (protectedRows.has(key.sourceRowNumber))
                                    continue;
                                await manager
                                    .getRepository(listing_record_entity_js_1.ListingRecord)
                                    .upsert(listing, [
                                    'sourceFileName',
                                    'sheetName',
                                    'sourceRowNumber',
                                ]);
                            }
                        }
                        if (importRowEntries.length > 0) {
                            await manager
                                .getRepository(catalog_import_row_entity_js_1.CatalogImportRow)
                                .save(importRowEntries);
                        }
                    });
                    for (const entry of importRowEntries) {
                        if (typeof entry.rowNumber === 'number')
                            processedRowNumbers.add(entry.rowNumber);
                    }
                    insertedRows += productsToInsert.length;
                }
                const shouldReportProgress = physicalCursor % PROGRESS_UPDATE_INTERVAL === 0 ||
                    physicalCursor >= totalRows;
                const shouldMirrorImages = this.shouldMirrorCatalogImages();
                await this.importRepo.update(importId, {
                    processedRows: physicalCursor,
                    insertedRows,
                    updatedRows,
                    skippedDuplicates,
                    flaggedForReview,
                    invalidRows,
                    lastProcessedRow: physicalCursor,
                    warnings: warnings.length > 0 ? warnings : null,
                });
                if (shouldReportProgress) {
                    this.eventEmitter.emit('catalog-import.progress', {
                        importId,
                        processedRows: physicalCursor,
                        totalRows,
                        insertedRows,
                        updatedRows,
                        skippedDuplicates,
                        flaggedForReview,
                        invalidRows,
                        phase: (productsToInsert.length > 0 || productsToUpdate.length > 0) &&
                            shouldMirrorImages
                            ? 'mirroring_images'
                            : 'batch',
                    });
                }
                if (vertical === 'fashion' && shouldMirrorImages) {
                    const committedRows = importRowEntries.filter((entry) => entry.status === 'inserted' || entry.status === 'updated');
                    const productIds = committedRows
                        .map((entry) => entry.createdProductId ?? entry.matchedProductId)
                        .filter((id) => Boolean(id));
                    if (productIds.length) {
                        const committedProducts = await this.productRepo.findBy({
                            id: (0, typeorm_2.In)([...new Set(productIds)]),
                        });
                        const sourceRows = new Map();
                        for (const entry of committedRows) {
                            const productId = entry.createdProductId ?? entry.matchedProductId;
                            if (productId && typeof entry.rowNumber === 'number')
                                sourceRows.set(productId, entry.rowNumber);
                        }
                        const exportProducts = committedProducts.filter((product) => product.verticalAttributes?._sourceFormat ===
                            'artisticserver-fashion-export');
                        if (exportProducts.length) {
                            await this.mirrorFashionImagesForBatch(exportProducts, sourceRows, importRecord, listingSheetName, warnings);
                        }
                    }
                    const genericInserted = savedBatchProducts
                        .map((product, index) => ({
                        product,
                        listing: listingsToInsert[index],
                    }))
                        .filter(({ product }) => product.verticalAttributes?._sourceFormat !==
                        'artisticserver-fashion-export');
                    if (genericInserted.length) {
                        await this.mirrorImagesForInsertedBatch(genericInserted.map(({ product }) => product), genericInserted.map(({ listing }) => listing), importRecord, listingSheetName);
                    }
                }
                else if (savedBatchProducts.length > 0 && shouldMirrorImages) {
                    await this.mirrorImagesForInsertedBatch(savedBatchProducts, listingsToInsert, importRecord, listingSheetName);
                }
                if (shouldReportProgress) {
                    this.eventEmitter.emit('catalog-import.progress', {
                        importId,
                        processedRows: physicalCursor,
                        totalRows,
                        insertedRows,
                        updatedRows,
                        skippedDuplicates,
                        flaggedForReview,
                        invalidRows,
                        phase: 'batch',
                    });
                }
                if (warnings.length > 0)
                    await this.importRepo.update(importId, { warnings });
                await job.updateProgress(totalRows > 0 ? Math.round((physicalCursor / totalRows) * 100) : 100);
            }
            if (vertical === 'fashion' && this.shouldMirrorCatalogImages()) {
                const shouldContinue = await this.retryPendingFashionImages(importRecord, listingSheetName, warnings);
                if (!shouldContinue)
                    return;
            }
            if (vertical === 'fashion' &&
                !this.shouldMirrorCatalogImages() &&
                warnings.length < 500) {
                warnings.push('Fashion source images remain pending because CATALOG_MIRROR_IMAGES=false; enable image mirroring and re-import the catalogue.');
            }
            if (fitmentMergedLines > 0 && warnings.length < 500) {
                warnings.unshift(`eBay File Exchange: merged ${fitmentMergedLines} vehicle compatibility continuation line(s) into parent listing rows.`);
                await this.importRepo.update(importId, { warnings });
            }
            if (orphanFitmentLines > 0) {
                this.logger.warn(`Import ${importId}: skipped ${orphanFitmentLines} orphan compatibility row(s) (no preceding listing row).`);
            }
            await this.dataSource.query(`
        UPDATE "listing_records" SET "searchVector" =
          setweight(to_tsvector('english', COALESCE("customLabelSku", '')), 'A') ||
          setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
          setweight(to_tsvector('english', COALESCE("cBrand", '')), 'B') ||
          setweight(to_tsvector('english', COALESCE("cManufacturerPartNumber", '')), 'B') ||
          setweight(to_tsvector('english', COALESCE("cOeOemPartNumber", '')), 'B') ||
          setweight(to_tsvector('english', COALESCE("categoryName", '')), 'C') ||
          setweight(to_tsvector('english', COALESCE("cType", '')), 'C') ||
          setweight(to_tsvector('english', COALESCE("cFeatures", '')), 'C') ||
          setweight(to_tsvector('english', COALESCE("description", '')), 'D')
        WHERE "sheetName" = $1
        `, [listingSheetName]);
            await this.importRepo.update(importId, {
                status: 'completed',
                processedRows: totalRows,
                insertedRows,
                updatedRows,
                skippedDuplicates,
                flaggedForReview,
                invalidRows,
                lastProcessedRow: totalRows,
                completedAt: new Date(),
                warnings: warnings.length > 0 ? warnings : null,
            });
            this.logger.log(`Import ${importId} completed: ${insertedRows} inserted, ${updatedRows} updated, ${skippedDuplicates} duplicates, ${flaggedForReview} flagged, ${invalidRows} invalid`);
            this.eventEmitter.emit('catalog-import.completed', {
                importId,
                insertedRows,
                updatedRows,
                skippedDuplicates,
                flaggedForReview,
                invalidRows,
                totalRows,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const maxAttempts = Math.max(1, Number(job.opts.attempts ?? 1));
            const queueRetryScheduled = job.attemptsMade + 1 < maxAttempts;
            const localRetryScheduled = localAttempt < localAttemptLimit && isRetryableCatalogImportError(err);
            const retryScheduled = queueRetryScheduled || localRetryScheduled;
            if (queueRetryScheduled) {
                this.logger.warn(`Import ${importId} attempt ${job.attemptsMade + 1}/${maxAttempts} failed; BullMQ will retry it: ${message}`);
            }
            else if (localRetryScheduled) {
                this.logger.warn(`Import ${importId} encountered a transient issue; it will restart from its saved checkpoint (${localAttempt + 1}/${localAttemptLimit}): ${message}`);
            }
            else {
                this.logger.error(`Import ${importId} failed after ${maxAttempts} attempt(s): ${message}`);
            }
            await this.importRepo.update(importId, {
                status: retryScheduled ? 'processing' : 'failed',
                errorMessage: retryScheduled ? null : message.substring(0, 2000),
            });
            if (!retryScheduled) {
                this.eventEmitter.emit('catalog-import.failed', {
                    importId,
                    error: message,
                });
            }
            throw err;
        }
    }
    async resetFashionReview(manager, product) {
        if (!product.organizationId)
            throw new Error('Fashion import requires an organization');
        const reviews = manager.getRepository(fashion_review_entity_js_1.FashionReview);
        const existing = await reviews.findOneBy({
            catalogProductId: product.id,
            organizationId: product.organizationId,
        });
        await reviews.save(reviews.create({
            ...(existing ?? {}),
            catalogProductId: product.id,
            organizationId: product.organizationId,
            status: 'pending',
            authenticityConfirmed: false,
            reviewedByUserId: null,
            reviewedAt: null,
            evidenceKeys: existing?.evidenceKeys ?? [],
        }));
    }
    async resetBusinessIndustrialReview(manager, product) {
        if (!product.organizationId)
            throw new Error('Business & Industrial import requires an organization');
        const reviews = manager.getRepository(business_industrial_review_entity_js_1.BusinessIndustrialReview);
        const existing = await reviews.findOneBy({
            catalogProductId: product.id,
            organizationId: product.organizationId,
        });
        await reviews.save(reviews.create({
            ...(existing ?? {}),
            catalogProductId: product.id,
            organizationId: product.organizationId,
            status: 'pending',
            provenanceConfirmed: false,
            specificationsVerified: false,
            testingReviewed: false,
            restrictedCategoryCleared: false,
            reviewedByUserId: null,
            reviewedAt: null,
            reviewedProductUpdatedAt: null,
            evidenceKeys: existing?.evidenceKeys ?? [],
            riskFlags: [],
        }));
    }
    pullNextNonAutomotiveLogicalRow(dataLines, headers, columnMapping, cursor) {
        if (cursor >= dataLines.length) {
            return {
                primary: null,
                nextPhysicalIndex: cursor,
                mergedFitmentLines: 0,
                skippedOrphanFitment: false,
            };
        }
        const rawLine = dataLines[cursor];
        const cells = this.parseCsvLine(rawLine);
        if (this.isFileExchangeFitmentContinuation(cells, headers)) {
            return {
                primary: null,
                nextPhysicalIndex: cursor + 1,
                mergedFitmentLines: 0,
                skippedOrphanFitment: true,
            };
        }
        return {
            primary: {
                rowNumber: cursor + 1,
                data: this.parseRow(rawLine, headers, columnMapping),
                rawLine,
            },
            nextPhysicalIndex: cursor + 1,
            mergedFitmentLines: 0,
            skippedOrphanFitment: false,
        };
    }
    pullNextFileExchangeLogicalRow(dataLines, headers, columnMapping, cursor) {
        if (cursor >= dataLines.length) {
            return {
                primary: null,
                nextPhysicalIndex: cursor,
                mergedFitmentLines: 0,
                skippedOrphanFitment: false,
            };
        }
        const firstLine = dataLines[cursor];
        const firstCells = this.parseCsvLine(firstLine);
        if (this.isFileExchangeFitmentContinuation(firstCells, headers)) {
            return {
                primary: null,
                nextPhysicalIndex: cursor + 1,
                mergedFitmentLines: 0,
                skippedOrphanFitment: true,
            };
        }
        const chunk = [firstLine];
        let next = cursor + 1;
        let mergedFitmentLines = 0;
        while (next < dataLines.length) {
            const nc = this.parseCsvLine(dataLines[next]);
            if (!this.isFileExchangeFitmentContinuation(nc, headers)) {
                break;
            }
            chunk.push(dataLines[next]);
            mergedFitmentLines++;
            next++;
        }
        const primaryLine = chunk[0];
        const data = this.parseRow(primaryLine, headers, columnMapping);
        const fitmentObjs = [];
        for (let i = 1; i < chunk.length; i++) {
            const fc = this.parseCsvLine(chunk[i]);
            const det = this.extractRelationshipDetailsCell(fc, headers);
            if (det) {
                fitmentObjs.push(this.parseFitmentPipeDetails(det));
            }
        }
        if (fitmentObjs.length > 0) {
            data['_fitmentRecordsJson'] = JSON.stringify(fitmentObjs);
        }
        return {
            primary: {
                rowNumber: cursor + 1,
                data,
                rawLine: primaryLine,
            },
            nextPhysicalIndex: next,
            mergedFitmentLines,
            skippedOrphanFitment: false,
        };
    }
    headerBaseName(header) {
        return header.replace(/^\*/, '').split('(')[0].trim().toLowerCase();
    }
    columnIndexByBaseName(headers, base) {
        return headers.findIndex((h) => this.headerBaseName(h) === base);
    }
    isFileExchangeFitmentContinuation(cells, headers) {
        const ri = this.columnIndexByBaseName(headers, 'relationship');
        if (ri < 0 || ri >= cells.length) {
            return false;
        }
        const rel = cells[ri]?.trim() || '';
        if (!/^Compatibility$/i.test(rel)) {
            return false;
        }
        const ci = this.columnIndexByBaseName(headers, 'customlabel');
        if (ci >= 0 && ci < cells.length && cells[ci]?.trim()) {
            return false;
        }
        const action = cells[0]?.trim() || '';
        if (/^(Add|Revise|Relist|Delete|End|Verify)/i.test(action)) {
            return false;
        }
        return true;
    }
    extractRelationshipDetailsCell(cells, headers) {
        const di = this.columnIndexByBaseName(headers, 'relationshipdetails');
        if (di < 0 || di >= cells.length) {
            return null;
        }
        const v = cells[di]?.trim();
        return v || null;
    }
    parseFitmentPipeDetails(details) {
        const out = {};
        for (const part of details.split('|')) {
            const eq = part.indexOf('=');
            if (eq > 0) {
                const k = part.slice(0, eq).trim();
                const v = part.slice(eq + 1).trim();
                if (k) {
                    out[k] = v;
                }
            }
        }
        return out;
    }
    async enrichRowsFromEbayBrowse(rows) {
        if (!this.browseApi || rows.length === 0) {
            return;
        }
        const targets = rows.filter((r) => {
            const id = r.data['ebayItemId']?.trim();
            return Boolean(id && /^\d{9,}$/.test(id));
        });
        if (targets.length === 0) {
            return;
        }
        const concurrency = Math.max(1, Number(this.config.get('CATALOG_IMPORT_EBAY_BROWSE_CONCURRENCY', '4')) || 4);
        for (let i = 0; i < targets.length; i += concurrency) {
            const slice = targets.slice(i, i + concurrency);
            await Promise.all(slice.map(async (r) => {
                const legacyId = r.data['ebayItemId'].trim();
                try {
                    const item = await this.browseApi.getItemByLegacyId(legacyId);
                    if (!r.data['title']?.trim() && item.title) {
                        r.data['title'] = item.title;
                    }
                    if (!r.data['brand']?.trim()) {
                        const aspectBrand = item.localizedAspects?.find((a) => a.name.toLowerCase() === 'brand')?.value;
                        const b = item.brand || aspectBrand;
                        if (b) {
                            r.data['brand'] = b;
                        }
                    }
                    if (!r.data['imageUrls']?.trim() && item.image?.imageUrl) {
                        r.data['imageUrls'] = item.image.imageUrl;
                    }
                }
                catch (e) {
                    this.logger.debug(`Browse enrich skipped for item ${legacyId}: ${e instanceof Error ? e.message : e}`);
                }
            }));
        }
    }
    async enrichMissingCategories(rows) {
        if (!this.categoryLookup)
            return;
        const targets = rows.filter((r) => {
            const hasCategory = r.data['categoryId']?.trim();
            const hasQuery = r.data['brand']?.trim() || r.data['title']?.trim();
            return !hasCategory && hasQuery;
        });
        if (targets.length === 0)
            return;
        this.logger.log(`Looking up eBay categories for ${targets.length} rows missing categoryId`);
        const concurrency = 3;
        let lookedUp = 0;
        for (let i = 0; i < targets.length; i += concurrency) {
            const slice = targets.slice(i, i + concurrency);
            await Promise.all(slice.map(async (r) => {
                try {
                    const result = await this.categoryLookup.lookupCategory(r.data['title'], r.data['brand'], r.data['partType'], r.data['mpn']);
                    if (result.categoryId) {
                        r.data['categoryId'] = result.categoryId;
                        r.data['categoryName'] = result.categoryName ?? '';
                        lookedUp++;
                    }
                }
                catch {
                }
            }));
        }
        if (lookedUp > 0) {
            this.logger.log(`Category enrichment complete: ${lookedUp}/${targets.length} rows resolved`);
        }
    }
    shouldMirrorCatalogImages() {
        return this.config.get('CATALOG_MIRROR_IMAGES', 'true') !== 'false';
    }
    async retryPendingFashionImages(importRecord, listingSheetName, warnings) {
        let afterSourceRow = 0;
        while (true) {
            const currentStatus = await this.importRepo.findOne({
                where: { id: importRecord.id },
                select: ['status'],
            });
            if (currentStatus?.status === 'cancelled')
                return false;
            const products = await this.productRepo
                .createQueryBuilder('product')
                .where('"product"."import_id" = :importId', {
                importId: importRecord.id,
            })
                .andWhere('"product"."vertical" = :vertical', {
                vertical: 'fashion',
            })
                .andWhere('"product"."vertical_attributes" ->> \'_sourceFormat\' = :sourceFormat', { sourceFormat: 'artisticserver-fashion-export' })
                .andWhere("COALESCE(\"product\".\"vertical_attributes\" ->> '_imageMirrorStatus', 'pending') NOT IN ('complete', 'no_images')")
                .andWhere('"product"."source_row" > :afterSourceRow', {
                afterSourceRow,
            })
                .orderBy('product.sourceRow', 'ASC')
                .addOrderBy('product.id', 'ASC')
                .take(FASHION_PENDING_IMAGE_BATCH_SIZE)
                .getMany();
            if (products.length === 0)
                return true;
            const sourceRows = new Map();
            for (const product of products) {
                if (product.sourceRow !== null)
                    sourceRows.set(product.id, product.sourceRow);
            }
            await this.mirrorFashionImagesForBatch(products, sourceRows, importRecord, listingSheetName, warnings);
            afterSourceRow = Math.max(...products.map((product) => product.sourceRow ?? afterSourceRow));
        }
    }
    async mirrorFashionImagesForBatch(products, sourceRows, importRecord, listingSheetName, warnings) {
        const skuConcurrency = Math.max(1, Math.min(2, Number(this.config.get('CATALOG_IMPORT_IMAGE_SKU_CONCURRENCY', '4')) || 4));
        const readRemoteBody = async (response) => {
            const declaredLength = Number(response.headers.get('content-length') ?? 0);
            if (declaredLength > FASHION_IMAGE_MAX_BYTES)
                throw new Error('source image exceeds the 25 MB import limit');
            if (!response.body) {
                const body = Buffer.from(await response.arrayBuffer());
                if (body.length > FASHION_IMAGE_MAX_BYTES)
                    throw new Error('source image exceeds the 25 MB import limit');
                return body;
            }
            const reader = response.body.getReader();
            const chunks = [];
            let length = 0;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    const chunk = Buffer.from(value);
                    length += chunk.length;
                    if (length > FASHION_IMAGE_MAX_BYTES) {
                        await reader.cancel();
                        throw new Error('source image exceeds the 25 MB import limit');
                    }
                    chunks.push(chunk);
                }
            }
            finally {
                reader.releaseLock();
            }
            return Buffer.concat(chunks, length);
        };
        const mirrorOne = async (product) => {
            const urls = fashionSourceImageUrls(product);
            const storedUrls = [];
            const namespace = `fashion/catalog/${product.id}`;
            for (let offset = 0; offset < urls.length; offset += FASHION_IMAGE_CONCURRENCY) {
                const slice = urls.slice(offset, offset + FASHION_IMAGE_CONCURRENCY);
                const converted = await Promise.all(slice.map(async (url) => {
                    const key = this.storageService.mirroredObjectKey(namespace, url, '.webp');
                    for (let attempt = 1; attempt <= FASHION_IMAGE_RETRY_ATTEMPTS; attempt++) {
                        try {
                            if (await this.storageService.objectExists(key))
                                return this.storageService.getCdnUrl(key);
                            const sourceKey = this.storageService.keyFromUrl(url);
                            let source;
                            if (sourceKey) {
                                source = await this.storageService.getObjectBuffer(sourceKey);
                                if (source.length > FASHION_IMAGE_MAX_BYTES)
                                    throw new Error('source image exceeds the 25 MB import limit');
                            }
                            else {
                                const response = await fetch(url, {
                                    redirect: 'follow',
                                    signal: AbortSignal.timeout(60_000),
                                    headers: {
                                        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
                                        'User-Agent': 'RealTrackApp-Fashion-Import/1.0',
                                    },
                                });
                                if (!response.ok)
                                    throw new Error(`source image returned HTTP ${response.status}`);
                                source = await readRemoteBody(response);
                            }
                            const webp = await this.imageProcessor.convertBufferToWebp(source, {
                                maxPixelCount: FASHION_IMAGE_MAX_PIXEL_COUNT,
                            });
                            await this.storageService.putObject(key, webp.buffer, 'image/webp');
                            return this.storageService.getCdnUrl(key);
                        }
                        catch (error) {
                            if (attempt < FASHION_IMAGE_RETRY_ATTEMPTS &&
                                isRetryableFashionImageError(error)) {
                                await wait(FASHION_IMAGE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
                                continue;
                            }
                            this.logger.warn(`Fashion image mirror failed for SKU ${product.sku ?? product.id}: ${error instanceof Error ? error.message : String(error)}`);
                            return null;
                        }
                    }
                    return null;
                }));
                storedUrls.push(...converted.filter((url) => Boolean(url)));
            }
            const expected = urls.length;
            const stored = storedUrls.length;
            const mirrorStatus = expected === 0
                ? 'no_images'
                : stored === expected
                    ? 'complete'
                    : stored > 0
                        ? 'partial'
                        : 'failed';
            const mirrorMeta = {
                _sourceFormat: 'artisticserver-fashion-export',
                _sourceImageUrls: urls,
                _imageMirrorExpected: String(expected),
                _imageMirrorStored: String(stored),
                _imageMirrorFailed: String(expected - stored),
                _imageMirrorStatus: mirrorStatus,
            };
            const rowNumber = sourceRows.get(product.id);
            await this.dataSource.transaction(async (manager) => {
                await manager.query(`UPDATE "catalog_products"
           SET "image_urls" = $2, "vertical_attributes" =
             COALESCE("vertical_attributes", '{}'::jsonb) || $3::jsonb
           WHERE "id" = $1 AND "vertical" = 'fashion'`, [product.id, storedUrls, JSON.stringify(mirrorMeta)]);
                if (rowNumber !== undefined) {
                    await manager.getRepository(listing_record_entity_js_1.ListingRecord).update({
                        sourceFileName: importRecord.fileName,
                        sheetName: listingSheetName,
                        sourceRowNumber: rowNumber,
                    }, { itemPhotoUrl: storedUrls.join('|') || null });
                }
                if (rowNumber !== undefined &&
                    mirrorStatus !== 'complete' &&
                    mirrorStatus !== 'no_images') {
                    const message = `Fashion image copy is ${mirrorStatus}: ${stored}/${expected} source images converted to WebP in application storage.`;
                    await manager
                        .getRepository(catalog_import_row_entity_js_1.CatalogImportRow)
                        .update({ importId: importRecord.id, rowNumber }, { message });
                }
                else if (rowNumber !== undefined) {
                    await manager
                        .getRepository(catalog_import_row_entity_js_1.CatalogImportRow)
                        .createQueryBuilder()
                        .update(catalog_import_row_entity_js_1.CatalogImportRow)
                        .set({ message: null })
                        .where('"import_id" = :importId AND "row_number" = :rowNumber', {
                        importId: importRecord.id,
                        rowNumber,
                    })
                        .andWhere('"message" LIKE :messagePrefix', {
                        messagePrefix: 'Fashion image copy is %',
                    })
                        .execute();
                }
            });
            if (rowNumber !== undefined) {
                const warningPrefix = `Row ${rowNumber}: Fashion image copy is `;
                for (let index = warnings.length - 1; index >= 0; index--) {
                    if (warnings[index].startsWith(warningPrefix))
                        warnings.splice(index, 1);
                }
                if (mirrorStatus !== 'complete' && mirrorStatus !== 'no_images') {
                    const warning = `Row ${rowNumber}: Fashion image copy is ${mirrorStatus}: ${stored}/${expected} source images converted to WebP in application storage.`;
                    if (warnings.length < 500)
                        warnings.push(warning);
                }
            }
        };
        for (let offset = 0; offset < products.length; offset += skuConcurrency) {
            await Promise.all(products.slice(offset, offset + skuConcurrency).map(mirrorOne));
        }
    }
    async mirrorImagesForInsertedBatch(products, listings, importRecord, listingSheetName) {
        if (products.length !== listings.length) {
            this.logger.warn(`mirrorImagesForInsertedBatch: length mismatch products=${products.length} listings=${listings.length}`);
        }
        const n = Math.min(products.length, listings.length);
        const skuConcurrency = Math.max(1, Number(this.config.get('CATALOG_IMPORT_IMAGE_SKU_CONCURRENCY', '4')) || 4);
        const mirrorOne = async (i) => {
            const product = products[i];
            const urls = product.imageUrls?.filter((u) => /^https?:\/\//i.test(u.trim())) ?? [];
            if (urls.length === 0)
                return;
            const skuPart = (product.sku || product.id).replace(/[^a-zA-Z0-9_-]/g, '_');
            const ns = `${importRecord.id}/${skuPart}`;
            try {
                const mirrored = await this.storageService.mirrorRemoteImageUrls(urls, ns, IMAGE_MIRROR_CONCURRENCY);
                await this.productRepo.update(product.id, { imageUrls: mirrored });
                await this.listingRepo.update({
                    sourceFileName: importRecord.fileName,
                    sheetName: listingSheetName,
                    sourceRowNumber: listings[i].sourceRowNumber,
                }, { itemPhotoUrl: mirrored.filter(Boolean).join('|') });
            }
            catch (err) {
                this.logger.error(`Image mirror failed for SKU ${product.sku ?? product.id}: ${err instanceof Error ? err.message : err}`);
            }
        };
        for (let batch = 0; batch < n; batch += skuConcurrency) {
            const end = Math.min(batch + skuConcurrency, n);
            await Promise.all(Array.from({ length: end - batch }, (_, k) => mirrorOne(batch + k)));
        }
    }
    findHeaders(lines) {
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const cells = this.parseCsvLine(lines[i]);
            const hasAction = cells.some((c) => c.toLowerCase().includes('action') ||
                c.toLowerCase().includes('*action'));
            const hasTitle = cells.some((c) => c.toLowerCase().includes('title') ||
                c.toLowerCase().includes('*title'));
            if (hasAction || hasTitle) {
                return { headers: cells.map((c) => c.trim()), dataStartIdx: i + 1 };
            }
        }
        return {
            headers: this.parseCsvLine(lines[0]).map((c) => c.trim()),
            dataStartIdx: 1,
        };
    }
    parseRow(line, headers, columnMapping) {
        const cells = this.parseCsvLine(line);
        const mapped = {};
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const catalogField = columnMapping[header];
            if (catalogField && i < cells.length) {
                const value = cells[i]?.trim();
                if (value) {
                    mapped[catalogField] = value;
                }
            }
        }
        if (!mapped['imageUrls']) {
            const numberedImages = imageUrlsFromNumberedColumns(headers, cells);
            if (numberedImages)
                mapped['imageUrls'] = numberedImages;
        }
        return mapped;
    }
    validateRow(data) {
        const warnings = [];
        if (!data['title'] && !(data['brand'] && data['mpn'])) {
            return {
                valid: false,
                error: 'Missing required field: title or brand+mpn',
            };
        }
        if (!data['imageUrls'] || !data['imageUrls'].trim()) {
            warnings.push('Missing image URL — listings without images have significantly lower visibility');
        }
        else {
            const urls = data['imageUrls']
                .split('|')
                .map((u) => u.trim())
                .filter(Boolean);
            const validUrls = urls.filter((u) => /^https?:\/\/.+/i.test(u));
            if (validUrls.length === 0) {
                warnings.push('No valid image URL found (must start with http:// or https://)');
            }
        }
        if (!data['brand'] || !data['brand'].trim()) {
            warnings.push('Missing brand — brand is required for eBay item specifics');
        }
        return {
            valid: true,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
    mapToProduct(data, importId, rowNumber, vertical, organizationId) {
        const brand = data['brand'] || null;
        const mpn = data['mpn'] || null;
        const title = data['title'] || '';
        const importAttributes = vertical === 'business_industrial'
            ? (0, business_industrial_import_js_1.businessIndustrialAttributesFromImportRow)(data)
            : vertical === 'fashion'
                ? (0, fashion_catalog_export_js_1.fashionCatalogExportAttributes)(data, (0, vertical_config_js_1.attributesFromImportRow)('fashion', data))
                : (0, vertical_config_js_1.attributesFromImportRow)(vertical, data);
        const attributeValidation = (0, vertical_config_js_1.validateVerticalAttributes)(vertical, importAttributes);
        const mappedBrand = brand ||
            (vertical === 'fashion' &&
                typeof attributeValidation.attributes.brand === 'string'
                ? attributeValidation.attributes.brand
                : null);
        let imageUrls = [];
        if (data['imageUrls']) {
            imageUrls = data['imageUrls']
                .split('|')
                .map((u) => u.trim())
                .filter(Boolean);
        }
        if (vertical === 'automotive' && (0, ebay_listing_images_util_js_1.isSingleImageBrand)(brand)) {
            imageUrls = (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(imageUrls, brand);
        }
        let price = null;
        if (data['price']) {
            const parsed = parseFloat(data['price']);
            if (!isNaN(parsed))
                price = parsed;
        }
        let quantity = null;
        if (data['quantity']) {
            const parsed = parseInt(data['quantity'], 10);
            if (!isNaN(parsed))
                quantity = parsed;
        }
        const conditionId = data['conditionId'] || null;
        let conditionLabel = null;
        if (conditionId) {
            const conditionMap = {
                '1000': 'New',
                '1500': 'New other',
                '2000': 'Certified refurbished',
                '2500': 'Seller refurbished',
                '3000': 'Used',
                '3000-Used': 'Used',
                '4000': 'Very Good',
                '5000': 'Good',
                '6000': 'Acceptable',
                '7000': 'For parts or not working',
            };
            conditionLabel = conditionMap[conditionId] || conditionId;
        }
        let fitmentData = null;
        const rawFit = vertical === 'automotive'
            ? data['_fitmentRecordsJson']?.trim()
            : undefined;
        if (rawFit) {
            try {
                const parsed = JSON.parse(rawFit);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    fitmentData = parsed;
                }
            }
            catch {
            }
        }
        return {
            sku: data['sku'] || null,
            mpn: mpn,
            mpnNormalized: mpn ? this.normalizeMpn(mpn) : null,
            upc: (0, catalog_identifiers_js_1.normalizeCatalogUpc)(data['upc']),
            ean: data['ean'] || null,
            ebayItemId: data['ebayItemId'] || null,
            epid: data['epid'] || null,
            title: title,
            titleNormalized: title ? this.normalizeTitle(title) : null,
            description: data['description'] || null,
            brand: mappedBrand,
            brandNormalized: mappedBrand ? this.normalizeBrand(mappedBrand) : null,
            partType: data['partType'] || null,
            placement: data['placement'] || null,
            material: data['material'] || null,
            features: data['features'] || null,
            countryOfOrigin: data['countryOfOrigin'] || null,
            oemPartNumber: data['oemPartNumber'] || null,
            price,
            quantity,
            conditionId: conditionId?.replace(/-.*/, '') || null,
            conditionLabel,
            categoryId: data['categoryId'] || null,
            categoryName: data['categoryName'] || null,
            imageUrls,
            fitmentData: vertical === 'automotive' ? fitmentData : null,
            organizationId,
            vertical,
            verticalAttributes: attributeValidation.attributes,
            verticalValidationStatus: attributeValidation.errors.length
                ? 'needs_review'
                : 'draft',
            location: data['location'] || null,
            format: data['format'] || null,
            duration: data['duration'] || null,
            shippingProfile: data['shippingProfile'] || null,
            returnProfile: data['returnProfile'] || null,
            paymentProfile: data['paymentProfile'] || null,
            sourceFile: data['_sourceFile'] || null,
            sourceRow: rowNumber,
            importId,
        };
    }
    mapToListingRecord(data, rowNumber, sourceFileName, sourceFilePath, sheetName, vertical, organizationId) {
        const startPriceText = this.normalizeNumericText(data['price']);
        const quantityText = this.normalizeIntegerText(data['quantity']);
        const buyItNowPriceText = this.normalizeNumericText(data['buyItNowPrice']);
        const startPriceNum = this.parseNumber(startPriceText ?? undefined);
        const quantityNum = this.parseInteger(quantityText ?? undefined);
        const buyItNowPriceNum = this.parseNumber(buyItNowPriceText ?? undefined);
        const title = data['title'] || null;
        const { make: extractedMake, model: extractedModel } = (0, extract_make_model_from_title_js_1.extractMakeModelFromTitle)(title);
        const verticalAttributes = vertical === 'business_industrial'
            ? (0, business_industrial_import_js_1.businessIndustrialAttributesFromImportRow)(data)
            : vertical === 'fashion'
                ? (0, fashion_catalog_export_js_1.fashionCatalogExportAttributes)(data, (0, vertical_config_js_1.attributesFromImportRow)(vertical, data))
                : (0, vertical_config_js_1.attributesFromImportRow)(vertical, data);
        const importedBrand = data['brand'] ||
            (typeof verticalAttributes.brand === 'string'
                ? verticalAttributes.brand
                : null);
        return {
            organizationId,
            vertical,
            verticalAttributes,
            sourceFileName,
            sourceFilePath,
            origin: listing_record_entity_js_1.ListingOrigin.PIPELINE_IMPORT,
            sheetName,
            sourceRowNumber: rowNumber,
            action: data['action'] || 'Add',
            customLabelSku: data['sku'] || null,
            categoryId: data['categoryId'] || null,
            categoryName: data['categoryName'] || null,
            title,
            pUpc: data['upc'] || null,
            pEpid: data['epid'] || null,
            startPrice: startPriceText,
            quantity: quantityText,
            itemPhotoUrl: (0, ebay_listing_images_util_js_1.isSingleImageBrand)(data['brand'])
                ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)([data['imageUrls'] ?? ''], data['brand']).join('|') || null
                : data['imageUrls'] || null,
            conditionId: data['conditionId'] || null,
            description: data['description'] || null,
            format: data['format'] || null,
            duration: data['duration'] || null,
            buyItNowPrice: buyItNowPriceText,
            location: data['location'] || null,
            shippingProfileName: data['shippingProfile'] || null,
            returnProfileName: data['returnProfile'] || null,
            paymentProfileName: data['paymentProfile'] || null,
            cBrand: importedBrand,
            cType: data['partType'] || null,
            cFeatures: data['features'] || null,
            cManufacturerPartNumber: data['mpn'] || null,
            cOeOemPartNumber: data['oemPartNumber'] || null,
            cOperatingMode: data['operatingMode'] || null,
            cFuelType: data['fuelType'] || null,
            cDriveType: data['driveType'] || null,
            startPriceNum,
            quantityNum,
            buyItNowPriceNum,
            extractedMake,
            extractedModel,
        };
    }
    parseNumber(value) {
        if (!value)
            return null;
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    parseInteger(value) {
        if (!value)
            return null;
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    normalizeNumericText(value) {
        if (!value)
            return null;
        const cleaned = value.replace(/[$,\s]/g, '');
        if (!cleaned)
            return null;
        if (!/^-?\d+(\.\d+)?$/.test(cleaned))
            return null;
        return cleaned;
    }
    normalizeIntegerText(value) {
        if (!value)
            return null;
        const cleaned = value.replace(/[\s,]/g, '');
        if (!cleaned)
            return null;
        if (!/^-?\d+$/.test(cleaned))
            return null;
        return cleaned;
    }
    sanitizeCsvForLineSplit(content) {
        let result = '';
        let insideQuotes = false;
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const next = i + 1 < content.length ? content[i + 1] : '';
            if (char === '"') {
                if (insideQuotes && next === '"') {
                    result += '""';
                    i++;
                }
                else {
                    insideQuotes = !insideQuotes;
                    result += char;
                }
                continue;
            }
            if (insideQuotes && (char === '\n' || char === '\r')) {
                if (char === '\r' && next === '\n') {
                    i++;
                }
                result += ' ';
                continue;
            }
            result += char;
        }
        return result;
    }
    normalizeMpn(mpn) {
        return mpn
            .toUpperCase()
            .replace(/[\s\-_.\/\\]+/g, '')
            .trim();
    }
    normalizeBrand(brand) {
        return brand
            .toUpperCase()
            .replace(/[\s\-_.]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    normalizeTitle(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    normalizeIdentifier(value) {
        return value.trim();
    }
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else {
                    insideQuotes = !insideQuotes;
                }
            }
            else if (char === ',' && !insideQuotes) {
                result.push(current);
                current = '';
            }
            else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }
};
exports.CsvImportProcessor = CsvImportProcessor;
exports.CsvImportProcessor = CsvImportProcessor = CsvImportProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('catalog-import', {
        concurrency: 1,
        lockDuration: 5 * 60 * 1000,
        stalledInterval: 30_000,
        maxStalledCount: 5,
    }),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_import_entity_js_1.CatalogImport)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_import_row_entity_js_1.CatalogImportRow)),
    __param(2, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(3, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(11, (0, common_1.Optional)()),
    __param(12, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        duplicate_detection_service_js_1.DuplicateDetectionService,
        ebay_compliance_service_js_1.EbayComplianceService,
        typeorm_2.DataSource,
        event_emitter_1.EventEmitter2,
        storage_service_js_1.StorageService,
        image_processor_service_js_1.ImageProcessorService,
        config_1.ConfigService,
        ebay_browse_api_service_js_1.EbayBrowseApiService,
        category_lookup_service_js_1.CategoryLookupService])
], CsvImportProcessor);
//# sourceMappingURL=csv-import.processor.js.map