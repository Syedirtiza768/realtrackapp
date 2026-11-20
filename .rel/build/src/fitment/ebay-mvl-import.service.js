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
var EbayMvlImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayMvlImportService = void 0;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_mvl_entry_entity_js_1 = require("./entities/ebay-mvl-entry.entity.js");
const ebay_mvl_release_entity_js_1 = require("./entities/ebay-mvl-release.entity.js");
const ebay_mvl_parse_util_js_1 = require("./ebay-mvl-parse.util.js");
const ebay_mvl_store_service_js_1 = require("./ebay-mvl-store.service.js");
const ebay_mvl_workbook_util_js_1 = require("./ebay-mvl-workbook.util.js");
let EbayMvlImportService = EbayMvlImportService_1 = class EbayMvlImportService {
    releaseRepo;
    entryRepo;
    store;
    logger = new common_1.Logger(EbayMvlImportService_1.name);
    insertBatchSize = 2000;
    constructor(releaseRepo, entryRepo, store) {
        this.releaseRepo = releaseRepo;
        this.entryRepo = entryRepo;
        this.store = store;
    }
    resolveAllowedDirectory(requested) {
        const base = process.env.EBAY_MVL_DATA_DIR?.trim() ||
            path.resolve(process.cwd(), '..', 'drive-download-20260706T171856Z-3-001');
        if (!requested?.trim()) {
            return path.resolve(base);
        }
        const resolved = path.resolve(requested.trim());
        const allowedRoot = path.resolve(base);
        if (resolved !== allowedRoot &&
            !resolved.startsWith(`${allowedRoot}${path.sep}`)) {
            throw new common_1.BadRequestException(`Directory must be under EBAY_MVL_DATA_DIR (${allowedRoot})`);
        }
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
            throw new common_1.BadRequestException(`Directory not found: ${resolved}`);
        }
        return resolved;
    }
    async importDirectory(directory, options) {
        const dir = this.resolveAllowedDirectory(directory);
        const files = fs
            .readdirSync(dir)
            .filter((name) => name.toLowerCase().endsWith('.xlsx'))
            .map((name) => path.join(dir, name));
        const summary = {
            imported: [],
            errors: [],
        };
        for (const filePath of files) {
            try {
                const result = await this.importFile(filePath, undefined, options);
                summary.imported.push(result);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                summary.errors.push({ file: path.basename(filePath), error: message });
            }
        }
        return summary;
    }
    async importFile(filePath, marketplaceOverride, options) {
        if (!fs.existsSync(filePath)) {
            throw new common_1.BadRequestException(`File not found: ${filePath}`);
        }
        const fileName = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        const fileSha256 = (0, node_crypto_1.createHash)('sha256').update(fileBuffer).digest('hex');
        const workbook = (0, ebay_mvl_workbook_util_js_1.readMvlWorkbook)(filePath, options?.password);
        const detected = (0, ebay_mvl_parse_util_js_1.detectMvlDataSheetName)(workbook.SheetNames, fileName);
        if (!detected) {
            throw new common_1.BadRequestException(`Could not detect MVL data sheet in ${fileName}`);
        }
        const marketplace = marketplaceOverride ??
            detected.marketplace ??
            (0, ebay_mvl_parse_util_js_1.detectMvlMarketplaceFromFileName)(fileName);
        if (!marketplace) {
            throw new common_1.BadRequestException(`Could not detect marketplace for ${fileName}`);
        }
        const existing = await this.releaseRepo.findOne({
            where: { marketplace, fileSha256, status: 'active' },
        });
        if (existing && !options?.force) {
            this.logger.log(`Skipping ${fileName} — identical file already active for ${marketplace}`);
            return {
                releaseId: existing.id,
                marketplace,
                versionLabel: existing.versionLabel,
                fileName: existing.fileName,
                fileSha256: existing.fileSha256,
                sourceRowCount: existing.sourceRowCount,
                entryCount: existing.entryCount,
                skippedDuplicate: true,
            };
        }
        const { headers, rows } = (0, ebay_mvl_workbook_util_js_1.sheetToRows)(workbook, detected.sheetName);
        if (!headers.length) {
            throw new common_1.BadRequestException(`No headers found in ${fileName}`);
        }
        const versionLabel = (0, ebay_mvl_parse_util_js_1.extractVersionLabel)(fileName, detected.sheetName);
        const release = await this.releaseRepo.save(this.releaseRepo.create({
            marketplace,
            versionLabel,
            fileName,
            fileSha256,
            sourceRowCount: rows.length,
            entryCount: 0,
            status: 'importing',
        }));
        try {
            const entryCount = await this.parseAndInsertInChunks(release.id, marketplace, headers, rows);
            const previousActive = await this.releaseRepo.findOne({
                where: { marketplace, status: 'active' },
            });
            await this.store.supersedeActiveRelease(marketplace, release.id);
            if (previousActive && previousActive.id !== release.id) {
                await this.store.deleteEntriesForRelease(previousActive.id);
            }
            await this.releaseRepo.update(release.id, {
                status: 'active',
                entryCount,
                importedAt: new Date(),
                errorMessage: null,
            });
            this.store.clearCache(marketplace);
            this.logger.log(`Imported ${entryCount} MVL entries for ${marketplace} from ${fileName}`);
            return {
                releaseId: release.id,
                marketplace,
                versionLabel,
                fileName,
                fileSha256,
                sourceRowCount: rows.length,
                entryCount,
                skippedDuplicate: false,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await this.releaseRepo.update(release.id, {
                status: 'failed',
                errorMessage: message,
            });
            await this.store.deleteEntriesForRelease(release.id);
            this.store.clearCache(marketplace);
            throw err;
        }
    }
    async parseAndInsertInChunks(releaseId, marketplace, headers, rows) {
        const chunkSize = Math.max(500, parseInt(process.env.EBAY_MVL_PARSE_CHUNK_SIZE ?? '5000', 10) || 5000);
        let totalInserted = 0;
        for (let offset = 0; offset < rows.length; offset += chunkSize) {
            const chunk = rows.slice(offset, offset + chunkSize);
            const parsed = (0, ebay_mvl_parse_util_js_1.parseMvlSheetRows)(marketplace, headers, chunk);
            if (parsed.length === 0)
                continue;
            totalInserted += await this.bulkInsertEntries(releaseId, marketplace, parsed, { logProgress: false });
            const rowsDone = Math.min(offset + chunkSize, rows.length);
            if (rowsDone % 20_000 === 0 || rowsDone === rows.length) {
                this.logger.log(`MVL insert progress (${marketplace}): ${rowsDone}/${rows.length} source rows, ${totalInserted} entries`);
            }
        }
        if (totalInserted === 0) {
            throw new common_1.BadRequestException('No MVL entries parsed from workbook');
        }
        return totalInserted;
    }
    async bulkInsertEntries(releaseId, marketplace, parsed, options) {
        const logProgress = options?.logProgress ?? true;
        let inserted = 0;
        for (let i = 0; i < parsed.length; i += this.insertBatchSize) {
            const batch = parsed.slice(i, i + this.insertBatchSize).map((entry) => ({
                releaseId,
                marketplace,
                epid: entry.epid ?? null,
                make: entry.make,
                model: entry.model,
                year: entry.year,
                trim: entry.trim ?? null,
                engine: entry.engine ?? null,
                submodel: entry.submodel ?? null,
                variant: entry.variant ?? null,
                platform: entry.platform ?? null,
                body: entry.body ?? null,
                ktype: entry.ktype ?? null,
                displayName: entry.displayName ?? null,
                extras: entry.extras ?? null,
            }));
            await this.entryRepo
                .createQueryBuilder()
                .insert()
                .into(ebay_mvl_entry_entity_js_1.EbayMvlEntry)
                .values(batch)
                .execute();
            inserted += batch.length;
            if (logProgress &&
                (inserted % 20_000 === 0 || inserted === parsed.length)) {
                this.logger.log(`MVL insert progress (${marketplace}): ${inserted}/${parsed.length}`);
            }
        }
        return inserted;
    }
};
exports.EbayMvlImportService = EbayMvlImportService;
exports.EbayMvlImportService = EbayMvlImportService = EbayMvlImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_mvl_release_entity_js_1.EbayMvlRelease)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_mvl_entry_entity_js_1.EbayMvlEntry)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_mvl_store_service_js_1.EbayMvlStoreService])
], EbayMvlImportService);
//# sourceMappingURL=ebay-mvl-import.service.js.map