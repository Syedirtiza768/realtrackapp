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
var CatalogImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogImportService = void 0;
const vertical_types_js_1 = require("../verticals/vertical.types.js");
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const node_string_decoder_1 = require("node:string_decoder");
const XLSX = __importStar(require("xlsx"));
const catalog_import_entity_js_1 = require("./entities/catalog-import.entity.js");
const catalog_import_row_entity_js_1 = require("./entities/catalog-import-row.entity.js");
const catalog_product_entity_js_1 = require("./entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const job_visibility_js_1 = require("../common/utils/job-visibility.js");
const heavy_job_limiter_service_js_1 = require("../common/jobs/heavy-job-limiter.service.js");
const DEFAULT_COLUMN_MAP = {
    customlabel: 'sku',
    'custom label (sku)': 'sku',
    '*customlabel': 'sku',
    customlabelsku: 'sku',
    '*title': 'title',
    title: 'title',
    '*startprice': 'price',
    startprice: 'price',
    '*quantity': 'quantity',
    quantity: 'quantity',
    picurl: 'imageUrls',
    '*conditionid': 'conditionId',
    conditionid: 'conditionId',
    '*description': 'description',
    description: 'description',
    '*format': 'format',
    format: 'format',
    '*duration': 'duration',
    duration: 'duration',
    '*location': 'location',
    location: 'location',
    buyitnowprice: 'buyItNowPrice',
    '*category': 'categoryId',
    category: 'categoryId',
    categoryname: 'categoryName',
    shippingprofilename: 'shippingProfile',
    returnprofilename: 'returnProfile',
    paymentprofilename: 'paymentProfile',
    '*c:brand': 'brand',
    'c:brand': 'brand',
    'c:type': 'partType',
    'c:placement on vehicle': 'placement',
    'c:material': 'material',
    'c:features': 'features',
    'c:country of origin': 'countryOfOrigin',
    'c:country/region of manufacture': 'countryOfOrigin',
    'c:manufacturer part number': 'mpn',
    'c:oe/oem part number': 'oemPartNumber',
    'c:operatingmode': 'operatingMode',
    'c:fueltype': 'fuelType',
    'c:drivetype': 'driveType',
    sku: 'sku',
    mpn: 'mpn',
    'manufacturer part number': 'mpn',
    upc: 'upc',
    ean: 'ean',
    epid: 'epid',
    'p:upc': 'upc',
    'p:epid': 'epid',
    brand: 'brand',
    price: 'price',
    ebayitemid: 'ebayItemId',
    'ebay item id': 'ebayItemId',
    'item id': 'ebayItemId',
    'part type': 'partType',
    'oem part number': 'oemPartNumber',
    'image url': 'imageUrls',
    imageurl: 'imageUrls',
    imageurls: 'imageUrls',
    images: 'imageUrls',
    'image urls': 'imageUrls',
    all_image_urls: 'imageUrls',
    image_urls: 'imageUrls',
    'item specifics': 'itemSpecifics',
    itemspecifics: 'itemSpecifics',
    specifics: 'itemSpecifics',
    'marketplace id': 'sourceMarketplaceId',
    marketplaceid: 'sourceMarketplaceId',
    'ebay site id': 'sourceMarketplaceSiteId',
    'site id': 'sourceMarketplaceSiteId',
    marketplace: 'sourceMarketplaceName',
    'channel id': 'sourceChannelId',
    channelid: 'sourceChannelId',
    status: 'sourceChannelStatus',
    account: 'sourceAccountName',
    'account name': 'sourceAccountName',
    currency: 'sourcePriceCurrency',
    'price currency': 'sourcePriceCurrency',
    id: 'sourceMarketplaceItemId',
    'condition': 'sourceCondition',
    'category id': 'categoryId',
    'listing url': 'sourceListingUrl',
    'item url': 'sourceListingUrl',
    department: 'department',
    size: 'size',
    sizesystem: 'sizeSystem',
    'size system': 'sizeSystem',
    color: 'color',
    colour: 'color',
    measurements: 'measurements',
    'condition details': 'conditionDetails',
    conditiondetails: 'conditionDetails',
    manufacturer: 'manufacturer',
    model: 'model',
    'category family': 'categoryFamily',
    categoryfamily: 'categoryFamily',
    'inventory mode': 'inventoryMode',
    inventorymode: 'inventoryMode',
    'shipping mode': 'shippingMode',
    shippingmode: 'shippingMode',
    'voltage unit': 'voltageUnit',
    voltageunit: 'voltageUnit',
    'frequency unit': 'frequencyUnit',
    frequencyunit: 'frequencyUnit',
    'current unit': 'currentUnit',
    currentunit: 'currentUnit',
    'power unit': 'powerUnit',
    powerunit: 'powerUnit',
    'capacity unit': 'capacityUnit',
    capacityunit: 'capacityUnit',
    'dimensions length': 'dimensionsLength',
    'dimensions width': 'dimensionsWidth',
    'dimensions height': 'dimensionsHeight',
    'dimensions unit': 'dimensionsUnit',
    dimensionslength: 'dimensionsLength',
    dimensionswidth: 'dimensionsWidth',
    dimensionsheight: 'dimensionsHeight',
    dimensionsunit: 'dimensionsUnit',
    'weight unit': 'weightUnit',
    weightunit: 'weightUnit',
    pressure: 'pressure',
    'pressure unit': 'pressureUnit',
    pressureunit: 'pressureUnit',
    'compatible equipment': 'compatibleEquipment',
    compatibleequipment: 'compatibleEquipment',
    'included components': 'includedComponents',
    includedcomponents: 'includedComponents',
    'testing scope': 'testingScope',
    testingscope: 'testingScope',
    'test results': 'testResults',
    testresults: 'testResults',
    'total physical units': 'totalPhysicalUnits',
    totalphysicalunits: 'totalPhysicalUnits',
    'sellable lots': 'sellableLots',
    sellablelots: 'sellableLots',
    'units per lot': 'unitsPerLot',
    unitsperlot: 'unitsPerLot',
    'packed weight': 'packedWeight',
    packedweight: 'packedWeight',
    'packed weight unit': 'packedWeightUnit',
    packedweightunit: 'packedWeightUnit',
    'dispatch location': 'dispatchLocation',
    dispatchlocation: 'dispatchLocation',
    'shipping coverage': 'shippingCoverage',
    shippingcoverage: 'shippingCoverage',
    'freight loading facilities': 'freightLoadingFacilities',
    freightloadingfacilities: 'freightLoadingFacilities',
    voltage: 'voltage',
    power: 'power',
    dimensions: 'dimensions',
    capacity: 'capacity',
    'testing status': 'testingStatus',
    testingstatus: 'testingStatus',
    'included accessories': 'includedAccessories',
    includedaccessories: 'includedAccessories',
    'c:department': 'department',
    'c:size': 'size',
    'c:size system': 'sizeSystem',
    'c:color': 'color',
    'c:colour': 'color',
    'c:measurements': 'measurements',
    'c:condition details': 'conditionDetails',
    'c:item type': 'itemType',
    'c:product type': 'productType',
    'c:category family': 'categoryFamily',
    'c:pattern': 'pattern',
    'c:style': 'style',
    'c:composition': 'composition',
    itemtype: 'itemType',
    'item type': 'itemType',
    producttype: 'productType',
    'product type': 'productType',
    pattern: 'pattern',
    style: 'style',
    composition: 'composition',
    secondarycolor: 'secondaryColor',
    'secondary color': 'secondaryColor',
    'c:manufacturer': 'manufacturer',
    'c:model': 'model',
    'c:voltage': 'voltage',
    'c:power': 'power',
    'c:dimensions': 'dimensions',
    'c:capacity': 'capacity',
    'c:testing status': 'testingStatus',
    'c:included accessories': 'includedAccessories',
};
let CatalogImportService = CatalogImportService_1 = class CatalogImportService {
    importRepo;
    rowRepo;
    productRepo;
    listingRepo;
    importQueue;
    dataSource;
    heavyJobLimiter;
    logger = new common_1.Logger(CatalogImportService_1.name);
    uploadDir;
    constructor(importRepo, rowRepo, productRepo, listingRepo, importQueue, dataSource, heavyJobLimiter) {
        this.importRepo = importRepo;
        this.rowRepo = rowRepo;
        this.productRepo = productRepo;
        this.listingRepo = listingRepo;
        this.importQueue = importQueue;
        this.dataSource = dataSource;
        this.heavyJobLimiter = heavyJobLimiter;
        this.uploadDir =
            process.env.CATALOG_UPLOAD_DIR || path.resolve('uploads', 'catalog');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async clearAllCatalog(confirm) {
        const phrase = typeof confirm === 'string' ? confirm.trim() : '';
        if (phrase !== 'DELETE_ALL_CATALOG') {
            throw new common_1.BadRequestException('Body must be { "confirm": "DELETE_ALL_CATALOG" } to delete all catalog data.');
        }
        return await this.dataSource.transaction(async (manager) => {
            await manager.query(`SET LOCAL statement_timeout = '5min'`);
            const motorsBefore = await manager.query(`SELECT COUNT(*)::int AS c FROM "motors_products" WHERE "catalogProductId" IS NOT NULL`);
            const motorsUnlinked = Number(motorsBefore[0]?.c ?? 0);
            await manager.query(`UPDATE "motors_products" SET "catalogProductId" = NULL WHERE "catalogProductId" IS NOT NULL`);
            await manager.query(`UPDATE "motors_products" SET "listingId" = NULL WHERE "listingId" IS NOT NULL`);
            await manager.query(`UPDATE "master_products" SET "listing_record_id" = NULL WHERE "listing_record_id" IS NOT NULL`);
            const listingCountRows = await manager.query(`SELECT COUNT(*)::int AS c FROM "listing_records"`);
            const listingsBefore = Number(listingCountRows[0]?.c ?? 0);
            await manager.query(`DELETE FROM "listing_revisions"`);
            const auditCountRows = await manager.query(`SELECT COUNT(*)::int AS c FROM "compliance_audit_logs"`);
            const auditBefore = Number(auditCountRows[0]?.c ?? 0);
            await manager.query(`DELETE FROM "compliance_audit_logs"`);
            const cir = await manager
                .createQueryBuilder()
                .delete()
                .from(catalog_import_row_entity_js_1.CatalogImportRow)
                .execute();
            const ci = await manager
                .createQueryBuilder()
                .delete()
                .from(catalog_import_entity_js_1.CatalogImport)
                .execute();
            const cp = await manager
                .createQueryBuilder()
                .delete()
                .from(catalog_product_entity_js_1.CatalogProduct)
                .execute();
            await manager.query(`DELETE FROM "listing_records"`);
            const listingsDeleted = listingsBefore;
            this.logger.warn(`clearAllCatalog: motors catalog unlinked=${motorsUnlinked}, listing_rows_deleted=${listingsDeleted}, products=${cp.affected ?? 0}`);
            return {
                motorsProductsUnlinked: motorsUnlinked,
                listingRecordsDeleted: listingsDeleted,
                catalogProductsDeleted: cp.affected ?? 0,
                catalogImportsDeleted: ci.affected ?? 0,
                catalogImportRowsDeleted: cir.affected ?? 0,
                complianceAuditLogsDeleted: auditBefore,
            };
        });
    }
    async handleUpload(file, columnMapping, userId, vertical = 'automotive', organizationId) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isCsv = ext === '.csv';
        const isExcel = ext === '.xlsx' || ext === '.xls';
        if (!isCsv && !isExcel) {
            throw new common_1.BadRequestException('Only CSV and Excel (.xlsx, .xls) files are supported');
        }
        let filePath = file.path;
        const fileName = file.originalname;
        const mimeType = file.mimetype;
        if (isExcel) {
            const csvPath = filePath.replace(/\.[^.]*$/, '') + '.csv';
            this.convertExcelToCsv(filePath, csvPath);
            filePath = csvPath;
        }
        const { detectedHeaders, totalRows } = await this.scanUploadedCsvForMetadata(filePath);
        const resolvedMapping = columnMapping || this.autoMapColumns(detectedHeaders);
        const catalogImport = this.importRepo.create({
            fileName,
            filePath,
            fileSizeBytes: file.size,
            mimeType,
            detectedHeaders,
            columnMapping: resolvedMapping,
            totalRows,
            status: 'pending',
            createdBy: userId ?? null,
            organizationId: organizationId ?? null,
            vertical: (0, vertical_types_js_1.normalizeProductVertical)(vertical),
        });
        const saved = await this.importRepo.save(catalogImport);
        this.logger.log(`Uploaded ${fileName} → import ${saved.id} (${totalRows} data rows, ${detectedHeaders.length} columns)`);
        return saved;
    }
    convertExcelToCsv(xlsxPath, csvPath) {
        const workbook = XLSX.readFile(xlsxPath, { cellDates: false });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new common_1.BadRequestException('Excel file has no worksheets');
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            throw new common_1.BadRequestException(`Worksheet "${sheetName}" not found`);
        }
        const csvContent = XLSX.utils.sheet_to_csv(sheet, {
            forceQuotes: false,
            blankrows: false,
        });
        fs.writeFileSync(csvPath, csvContent, 'utf-8');
        this.logger.log(`Converted Excel → CSV: ${path.basename(xlsxPath)} → ${path.basename(csvPath)} (${(csvContent.length / 1024).toFixed(0)} KB)`);
    }
    async startImport(importId, columnMapping, actorId, viewAll = true) {
        await this.heavyJobLimiter.assertCatalogImportSlotAvailable();
        const importRecord = await this.importRepo.findOneBy({ id: importId });
        if (!importRecord) {
            throw new common_1.NotFoundException(`Import ${importId} not found`);
        }
        if (actorId) {
            (0, job_visibility_js_1.assertCanAccessJob)(importRecord.createdBy, actorId, viewAll);
        }
        if (importRecord.status !== 'pending' && importRecord.status !== 'paused') {
            throw new common_1.BadRequestException(`Import ${importId} is in "${importRecord.status}" state and cannot be started`);
        }
        if (importRecord.vertical === 'fashion' &&
            (!importRecord.filePath || !fs.existsSync(importRecord.filePath))) {
            throw new common_1.BadRequestException('Source file is unavailable. Upload the file again.');
        }
        const previousStatus = importRecord.status;
        if (columnMapping) {
            importRecord.columnMapping = columnMapping;
        }
        importRecord.createdBy = (0, job_visibility_js_1.withCreatedByBackfill)(importRecord.createdBy, actorId);
        importRecord.status = 'validating';
        importRecord.startedAt = new Date();
        if (importRecord.vertical === 'fashion') {
            const claimed = await this.importRepo.update({ id: importId, status: previousStatus }, {
                status: 'validating',
                startedAt: importRecord.startedAt,
                completedAt: null,
                errorMessage: null,
                columnMapping: importRecord.columnMapping,
            });
            if (!claimed.affected)
                throw new common_1.BadRequestException('Import was already started or cancelled. Refresh its status.');
        }
        else {
            await this.importRepo.save(importRecord);
        }
        try {
            await this.importQueue.add('process-csv', {
                importId: importRecord.id,
                filePath: importRecord.filePath,
                columnMapping: importRecord.columnMapping,
                resumeFromRow: importRecord.lastProcessedRow,
            }, {
                attempts: importRecord.vertical === 'fashion' ? 5 : 3,
                backoff: {
                    type: 'exponential',
                    delay: 30_000,
                },
                removeOnComplete: 50,
                removeOnFail: 100,
            });
        }
        catch (error) {
            if (importRecord.vertical === 'fashion') {
                await this.importRepo.update({ id: importId, status: 'validating' }, {
                    status: 'failed',
                    errorMessage: 'Could not queue import. Retry when the queue is available.',
                });
            }
            throw error;
        }
        this.logger.log(`Enqueued import ${importRecord.id} for processing`);
        return importRecord;
    }
    async listImports(status, limit = 20, offset = 0, viewerId, viewAll = true, scope) {
        const qb = this.importRepo
            .createQueryBuilder('i')
            .orderBy('i.createdAt', 'DESC');
        if (status)
            qb.andWhere('i.status = :status', { status });
        if (viewerId) {
            (0, job_visibility_js_1.applyCreatedByVisibility)(qb, 'i', viewerId, viewAll);
        }
        if (scope)
            this.applyImportScope(qb, scope);
        qb.take(limit).skip(offset);
        const [imports, total] = await qb.getManyAndCount();
        return { imports, total };
    }
    async getImport(id, viewerId, viewAll = true, scope) {
        const qb = this.importRepo
            .createQueryBuilder('i')
            .where('i.id = :id', { id });
        if (scope)
            this.applyImportScope(qb, scope);
        const record = await qb.getOne();
        if (!record)
            throw new common_1.NotFoundException(`Import ${id} not found`);
        if (viewerId && !(0, job_visibility_js_1.canViewJob)(record.createdBy, viewerId, viewAll)) {
            throw new common_1.ForbiddenException('You do not have access to this catalog import');
        }
        let verification = null;
        if (record.status === 'completed' ||
            record.status === 'processing' ||
            record.status === 'failed') {
            verification = await this.buildVerificationSummary(record);
        }
        return {
            import: record,
            verification,
        };
    }
    applyImportScope(qb, scope) {
        qb.andWhere("COALESCE(i.vertical, 'automotive') IN (:...verticals)", {
            verticals: scope.verticals.length ? scope.verticals : ['__none__'],
        });
        qb.andWhere("(COALESCE(i.vertical, 'automotive') = 'automotive' OR (COALESCE(i.vertical, 'automotive') IN ('fashion', 'business_industrial') AND i.organizationId = :organizationId AND i.createdBy IS NOT NULL))", {
            organizationId: scope.organizationId,
        });
        if (!scope.viewAll) {
            qb.andWhere("(i.createdBy = :scopeViewerId OR (i.createdBy IS NULL AND COALESCE(i.vertical, 'automotive') <> 'fashion'))", {
                scopeViewerId: scope.viewerId,
            });
        }
        return qb;
    }
    async previewImport(record) {
        if (!record.filePath || !fs.existsSync(record.filePath)) {
            throw new common_1.BadRequestException('Source file is unavailable. Upload the file again.');
        }
        const rows = [];
        let foundHeader = false;
        for await (const line of this.logicalLineIterator(record.filePath)) {
            if (!line.trim())
                continue;
            const cells = this.parseCsvLine(line.trim());
            if (!foundHeader) {
                foundHeader =
                    cells.length === record.detectedHeaders.length &&
                        cells.every((cell, index) => cell.trim() === record.detectedHeaders[index]);
                continue;
            }
            rows.push(Object.fromEntries(record.detectedHeaders.map((header, index) => [
                header,
                (cells[index] ?? '').slice(0, 2000),
            ])));
            if (rows.length === 5)
                break;
        }
        return rows;
    }
    async getImportRows(importId, status, limit = 50, offset = 0) {
        const where = { importId };
        if (status)
            where['status'] = status;
        const [rows, total] = await this.rowRepo.findAndCount({
            where,
            order: { rowNumber: 'ASC' },
            take: limit,
            skip: offset,
        });
        return { rows, total };
    }
    async cancelImport(id, actorId, viewAll = true) {
        const record = await this.importRepo.findOneBy({ id });
        if (!record)
            throw new common_1.NotFoundException(`Import ${id} not found`);
        if (actorId) {
            (0, job_visibility_js_1.assertCanAccessJob)(record.createdBy, actorId, viewAll);
        }
        if (record.status === 'completed' || record.status === 'cancelled') {
            throw new common_1.BadRequestException(`Import ${id} is already "${record.status}"`);
        }
        record.status = 'cancelled';
        record.completedAt = new Date();
        record.createdBy = (0, job_visibility_js_1.withCreatedByBackfill)(record.createdBy, actorId);
        return this.importRepo.save(record);
    }
    async retryImport(id, actorId, viewAll = true) {
        const record = await this.importRepo.findOneBy({ id });
        if (!record)
            throw new common_1.NotFoundException(`Import ${id} not found`);
        if (actorId) {
            (0, job_visibility_js_1.assertCanAccessJob)(record.createdBy, actorId, viewAll);
        }
        if (record.status !== 'failed') {
            throw new common_1.BadRequestException(`Import ${id} is not in failed state (current: ${record.status})`);
        }
        record.status = 'pending';
        record.errorMessage = null;
        record.createdBy = (0, job_visibility_js_1.withCreatedByBackfill)(record.createdBy, actorId);
        await this.importRepo.save(record);
        return this.startImport(record.id, undefined, actorId, viewAll);
    }
    async getImportStats(scope) {
        if (scope) {
            const scoped = () => this.applyImportScope(this.importRepo.createQueryBuilder('i'), scope);
            const [totalImports, aggregate, recentImports, totalCatalogProducts] = await Promise.all([
                scoped().getCount(),
                scoped()
                    .select('SUM(i.inserted_rows)', 'inserted')
                    .addSelect('SUM(i.skipped_duplicates)', 'duplicates')
                    .addSelect('SUM(i.invalid_rows)', 'invalid')
                    .getRawOne(),
                scoped().orderBy('i.createdAt', 'DESC').take(10).getMany(),
                this.productRepo
                    .createQueryBuilder('p')
                    .where(`p.importId IN (${scoped().select('i.id').getQuery()})`)
                    .setParameters(scoped().getParameters())
                    .getCount(),
            ]);
            return {
                totalImports,
                totalProductsInserted: Number(aggregate?.inserted ?? 0),
                totalDuplicatesSkipped: Number(aggregate?.duplicates ?? 0),
                totalInvalidRows: Number(aggregate?.invalid ?? 0),
                totalCatalogProducts,
                recentImports,
            };
        }
        const [totalImports, totalCatalogProducts] = await Promise.all([
            this.importRepo.count(),
            this.productRepo.count(),
        ]);
        const aggResult = await this.importRepo
            .createQueryBuilder('i')
            .select('SUM(i.inserted_rows)', 'totalInserted')
            .addSelect('SUM(i.skipped_duplicates)', 'totalDuplicates')
            .addSelect('SUM(i.invalid_rows)', 'totalInvalid')
            .getRawOne();
        const recentImports = await this.importRepo.find({
            order: { createdAt: 'DESC' },
            take: 10,
        });
        return {
            totalImports,
            totalProductsInserted: Number(aggResult?.totalInserted ?? 0),
            totalDuplicatesSkipped: Number(aggResult?.totalDuplicates ?? 0),
            totalInvalidRows: Number(aggResult?.totalInvalid ?? 0),
            totalCatalogProducts,
            recentImports,
        };
    }
    async backfillListings(importId) {
        const qb = this.importRepo
            .createQueryBuilder('i')
            .where('i.insertedRows > 0')
            .andWhere('i.status IN (:...statuses)', {
            statuses: ['completed', 'failed', 'cancelled'],
        })
            .orderBy('i.createdAt', 'ASC');
        if (importId) {
            qb.andWhere('i.id = :importId', { importId });
        }
        const imports = await qb.getMany();
        const summary = {
            scannedImports: imports.length,
            insertedListingRecords: 0,
            imports: [],
        };
        for (const importRecord of imports) {
            const listingSheetName = `Catalog Import ${importRecord.id}`;
            const existingBefore = await this.listingRepo.count({
                where: {
                    sourceFileName: importRecord.fileName,
                    sheetName: listingSheetName,
                },
            });
            const products = await this.productRepo
                .createQueryBuilder('p')
                .where('p.importId = :importId', { importId: importRecord.id })
                .orderBy('p.sourceRow', 'ASC', 'NULLS LAST')
                .addOrderBy('p.createdAt', 'ASC')
                .addOrderBy('p.id', 'ASC')
                .getMany();
            if (products.length === 0) {
                summary.imports.push({
                    importId: importRecord.id,
                    fileName: importRecord.fileName,
                    catalogProducts: 0,
                    insertedListingRecords: 0,
                });
                continue;
            }
            let importInserted = 0;
            const values = products.map((product, idx) => this.mapCatalogProductToListingRecord(product, importRecord.fileName, importRecord.filePath, listingSheetName, idx));
            const CHUNK_SIZE = 500;
            for (let i = 0; i < values.length; i += CHUNK_SIZE) {
                const chunk = values.slice(i, i + CHUNK_SIZE);
                await this.listingRepo
                    .createQueryBuilder()
                    .insert()
                    .into(listing_record_entity_js_1.ListingRecord)
                    .values(chunk)
                    .orIgnore()
                    .execute();
            }
            const existingAfter = await this.listingRepo.count({
                where: {
                    sourceFileName: importRecord.fileName,
                    sheetName: listingSheetName,
                },
            });
            importInserted = Math.max(0, existingAfter - existingBefore);
            summary.insertedListingRecords += importInserted;
            summary.imports.push({
                importId: importRecord.id,
                fileName: importRecord.fileName,
                catalogProducts: products.length,
                insertedListingRecords: importInserted,
            });
        }
        this.logger.log(`Backfill completed: ${summary.insertedListingRecords} listing records inserted across ${summary.scannedImports} imports`);
        return summary;
    }
    async *logicalLineIterator(filePath) {
        const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
        const decoder = new node_string_decoder_1.StringDecoder('utf8');
        let insideQuotes = false;
        let lineOut = '';
        const flushLine = () => {
            const line = lineOut;
            lineOut = '';
            return line;
        };
        const processTextChunk = function* (text) {
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const next = i + 1 < text.length ? text[i + 1] : '';
                if (char === '"') {
                    if (insideQuotes && next === '"') {
                        lineOut += '""';
                        i++;
                    }
                    else {
                        insideQuotes = !insideQuotes;
                        lineOut += char;
                    }
                    continue;
                }
                if (insideQuotes && (char === '\n' || char === '\r')) {
                    if (char === '\r' && next === '\n') {
                        i++;
                    }
                    lineOut += ' ';
                    continue;
                }
                if (char === '\r' && next === '\n') {
                    yield flushLine();
                    i++;
                    continue;
                }
                if (char === '\n') {
                    if (lineOut.endsWith('\r')) {
                        lineOut = lineOut.slice(0, -1);
                    }
                    yield flushLine();
                    continue;
                }
                lineOut += char;
            }
        };
        for await (const chunk of stream) {
            yield* processTextChunk(decoder.write(chunk));
        }
        yield* processTextChunk(decoder.end());
        if (lineOut.length > 0) {
            yield lineOut;
            lineOut = '';
        }
    }
    async scanUploadedCsvForMetadata(filePath) {
        let nonEmptyIdx = 0;
        let detectedHeaders = null;
        let firstNonEmptyLine = null;
        let headerIdxForCount = 0;
        let foundHeaderInFirst5 = false;
        for await (const rawLine of this.logicalLineIterator(filePath)) {
            const line = rawLine.trim();
            if (!line.length)
                continue;
            if (firstNonEmptyLine === null) {
                firstNonEmptyLine = line;
            }
            const cells = this.parseCsvLine(line);
            const hasAction = cells.some((c) => c.toLowerCase().includes('action') ||
                c.toLowerCase().includes('*action'));
            const hasTitle = cells.some((c) => c.toLowerCase().includes('title') ||
                c.toLowerCase().includes('*title'));
            if (!detectedHeaders && (hasAction || hasTitle)) {
                detectedHeaders = cells.map((c) => c.trim());
            }
            if (nonEmptyIdx < 5 && !foundHeaderInFirst5 && (hasAction || hasTitle)) {
                headerIdxForCount = nonEmptyIdx;
                foundHeaderInFirst5 = true;
            }
            nonEmptyIdx++;
        }
        if (!detectedHeaders) {
            detectedHeaders = firstNonEmptyLine
                ? this.parseCsvLine(firstNonEmptyLine).map((c) => c.trim())
                : [];
        }
        if (!foundHeaderInFirst5) {
            headerIdxForCount = 0;
        }
        const totalRows = Math.max(0, nonEmptyIdx - headerIdxForCount - 1);
        return { detectedHeaders, totalRows };
    }
    autoMapColumns(headers) {
        const mapping = {};
        const isArtisticServerExport = [
            'channel id',
            'marketplace id',
            'item specifics',
            'measurements',
        ].every((required) => headers.some((header) => header
            .toLowerCase()
            .replace(/\*/g, '')
            .trim() === required));
        for (const header of headers) {
            const key = header.toLowerCase().replace(/\*/g, '').trim();
            if (isArtisticServerExport && key === 'category') {
                mapping[header] = 'categoryName';
                continue;
            }
            if (DEFAULT_COLUMN_MAP[key]) {
                mapping[header] = DEFAULT_COLUMN_MAP[key];
            }
            else if (DEFAULT_COLUMN_MAP[header.toLowerCase().trim()]) {
                mapping[header] = DEFAULT_COLUMN_MAP[header.toLowerCase().trim()];
            }
        }
        return mapping;
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
    getCatalogFields() {
        return [
            { field: 'sku', label: 'SKU / Custom Label', required: false },
            { field: 'title', label: 'Product Title', required: true },
            { field: 'description', label: 'Description', required: false },
            { field: 'brand', label: 'Brand', required: false },
            { field: 'mpn', label: 'Manufacturer Part Number', required: false },
            { field: 'oemPartNumber', label: 'OE/OEM Part Number', required: false },
            { field: 'upc', label: 'UPC', required: false },
            { field: 'ean', label: 'EAN', required: false },
            { field: 'epid', label: 'ePID', required: false },
            { field: 'ebayItemId', label: 'eBay Item ID', required: false },
            { field: 'price', label: 'Price', required: false },
            { field: 'quantity', label: 'Quantity', required: false },
            { field: 'conditionId', label: 'Condition ID', required: false },
            { field: 'categoryId', label: 'Category ID', required: false },
            { field: 'categoryName', label: 'Category Name', required: false },
            { field: 'partType', label: 'Part Type', required: false },
            { field: 'placement', label: 'Placement on Vehicle', required: false },
            { field: 'material', label: 'Material', required: false },
            { field: 'features', label: 'Features', required: false },
            { field: 'countryOfOrigin', label: 'Country of Origin', required: false },
            { field: 'imageUrls', label: 'Image URLs', required: false },
            { field: 'itemSpecifics', label: 'Item Specifics', required: false },
            { field: 'sourceChannelStatus', label: 'Source Channel Status', required: false },
            { field: 'sourceChannelId', label: 'Source Channel ID', required: false },
            { field: 'sourceMarketplaceId', label: 'Source Marketplace ID', required: false },
            { field: 'sourceMarketplaceName', label: 'Source Marketplace', required: false },
            { field: 'sourceMarketplaceSiteId', label: 'Source Marketplace Site ID', required: false },
            { field: 'sourceMarketplaceItemId', label: 'Source Marketplace Item ID', required: false },
            { field: 'sourceCondition', label: 'Source Condition', required: false },
            { field: 'sourceAccountName', label: 'Source Account', required: false },
            { field: 'sourcePriceCurrency', label: 'Source Price Currency', required: false },
            { field: 'sourceListingUrl', label: 'Source Listing URL', required: false },
            { field: 'location', label: 'Location', required: false },
            { field: 'format', label: 'Listing Format', required: false },
            { field: 'duration', label: 'Duration', required: false },
            { field: 'shippingProfile', label: 'Shipping Profile', required: false },
            { field: 'returnProfile', label: 'Return Profile', required: false },
            { field: 'paymentProfile', label: 'Payment Profile', required: false },
            { field: 'manufacturer', label: 'Manufacturer', required: false },
            { field: 'model', label: 'Model', required: false },
            { field: 'department', label: 'Department', required: false },
            { field: 'size', label: 'Size', required: false },
            { field: 'sizeSystem', label: 'Size System', required: false },
            { field: 'color', label: 'Color', required: false },
            { field: 'measurements', label: 'Measurements', required: false },
            {
                field: 'conditionDetails',
                label: 'Condition Details',
                required: false,
            },
            { field: 'itemType', label: 'Item Type', required: false },
            { field: 'productType', label: 'Product Type', required: false },
            { field: 'pattern', label: 'Pattern', required: false },
            { field: 'style', label: 'Style', required: false },
            { field: 'composition', label: 'Composition', required: false },
            { field: 'voltage', label: 'Voltage', required: false },
            { field: 'power', label: 'Power', required: false },
            { field: 'dimensions', label: 'Dimensions', required: false },
            { field: 'capacity', label: 'Capacity', required: false },
            { field: 'testingStatus', label: 'Testing Status', required: false },
            {
                field: 'includedAccessories',
                label: 'Included Accessories',
                required: false,
            },
        ];
    }
    async buildVerificationSummary(record) {
        const listingSheetName = `Catalog Import ${record.id}`;
        const [catalogProductsByImport, listingRecordsByImport, insertedRows] = await Promise.all([
            this.productRepo.count({ where: { importId: record.id } }),
            this.listingRepo.count({
                where: {
                    sourceFileName: record.fileName,
                    sheetName: listingSheetName,
                },
            }),
            this.rowRepo.find({
                where: { importId: record.id, status: 'inserted' },
                order: { rowNumber: 'ASC' },
                take: 10,
            }),
        ]);
        const sampleSkus = insertedRows
            .map((row) => row.rawData?.['sku']?.trim())
            .filter((sku) => Boolean(sku));
        const dbInfoRaw = await this.importRepo.query('SELECT current_database() AS database, current_schema() AS schema');
        const dbInfo = Array.isArray(dbInfoRaw) && dbInfoRaw.length > 0
            ? {
                database: String(dbInfoRaw[0].database ?? ''),
                schema: String(dbInfoRaw[0].schema ?? ''),
            }
            : null;
        return {
            importId: record.id,
            expectedInsertedRows: record.insertedRows,
            catalogProductsByImport,
            listingRecordsByImport,
            sampleSkus,
            db: dbInfo,
        };
    }
    mapCatalogProductToListingRecord(product, sourceFileName, sourceFilePath, sheetName, fallbackIndex) {
        const rowNumber = product.sourceRow ?? 1_000_000 + fallbackIndex + 1;
        return {
            organizationId: null,
            sourceFileName,
            sourceFilePath: sourceFilePath ?? '',
            origin: listing_record_entity_js_1.ListingOrigin.PIPELINE_IMPORT,
            sheetName,
            sourceRowNumber: rowNumber,
            action: 'Add',
            customLabelSku: product.sku,
            categoryId: product.categoryId,
            categoryName: product.categoryName,
            title: product.title,
            pUpc: product.upc,
            pEpid: product.epid,
            startPrice: product.price != null ? String(product.price) : null,
            quantity: product.quantity != null ? String(product.quantity) : null,
            itemPhotoUrl: product.imageUrls?.length
                ? product.imageUrls.join('|')
                : null,
            conditionId: product.conditionId,
            description: product.description,
            format: product.format,
            duration: product.duration,
            location: product.location,
            shippingProfileName: product.shippingProfile,
            returnProfileName: product.returnProfile,
            paymentProfileName: product.paymentProfile,
            cBrand: product.brand,
            cType: product.partType,
            cFeatures: product.features,
            cManufacturerPartNumber: product.mpn,
            cOeOemPartNumber: product.oemPartNumber,
            startPriceNum: product.price,
            quantityNum: product.quantity,
        };
    }
};
exports.CatalogImportService = CatalogImportService;
exports.CatalogImportService = CatalogImportService = CatalogImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_import_entity_js_1.CatalogImport)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_import_row_entity_js_1.CatalogImportRow)),
    __param(2, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(3, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(4, (0, bullmq_1.InjectQueue)('catalog-import')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository, Function, typeorm_2.DataSource,
        heavy_job_limiter_service_js_1.HeavyJobLimiterService])
], CatalogImportService);
//# sourceMappingURL=catalog-import.service.js.map