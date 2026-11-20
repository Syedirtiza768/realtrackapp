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
var PipelineOutputImageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineOutputImageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const XLSX = __importStar(require("xlsx"));
const storage_service_js_1 = require("../../storage/storage.service.js");
const pipeline_image_matching_util_js_1 = require("../utils/pipeline-image-matching.util.js");
const S3_PATH_COLUMN = 'S3 Image Path';
const IMAGE_MIRROR_CONCURRENCY = 6;
const FEBEST_IMAGE_SOURCE_HOST = 'catalog.febest.eu';
const IMAGE_COLUMN_PATTERNS = [
    /^picurl$/i,
    /^item\s*photo\s*url$/i,
    /^artikelfoto-?url$/i,
    /^picture\s*url$/i,
    /^photo\s*url$/i,
    /^image\s*url$/i,
    /^additionalpicurl\d*$/i,
];
let PipelineOutputImageService = PipelineOutputImageService_1 = class PipelineOutputImageService {
    storageService;
    config;
    logger = new common_1.Logger(PipelineOutputImageService_1.name);
    constructor(storageService, config) {
        this.storageService = storageService;
        this.config = config;
    }
    shouldMirror() {
        const flag = this.config.get('PIPELINE_MIRROR_IMAGES', 'true');
        return !/^(0|false|no|off)$/i.test(String(flag).trim());
    }
    async mirrorImagesInOutputDir(jobId, outputDir) {
        if (!this.shouldMirror()) {
            this.logger.log(`Job ${jobId}: PIPELINE_MIRROR_IMAGES disabled — skipping S3 image mirror`);
            return;
        }
        if (!fs.existsSync(outputDir)) {
            return;
        }
        const files = fs
            .readdirSync(outputDir)
            .filter((f) => /\.(?:xlsx|csv)$/i.test(f) && !f.startsWith('~$'));
        if (files.length === 0) {
            this.logger.warn(`Job ${jobId}: No output XLSX files to mirror images`);
            return;
        }
        const skuConcurrency = Math.max(1, Number(this.config.get('PIPELINE_IMAGE_SKU_CONCURRENCY', '4')) ||
            4);
        let totalMirrored = 0;
        let totalRows = 0;
        for (const file of files) {
            const fullPath = path.join(outputDir, file);
            const { mirrored, rows } = await this.mirrorImagesInWorkbook(jobId, fullPath, skuConcurrency);
            totalMirrored += mirrored;
            totalRows += rows;
        }
        this.logger.log(`Job ${jobId}: Mirrored images for ${totalMirrored}/${totalRows} listing rows across ${files.length} output file(s)`);
    }
    async mirrorApprovedImageUrls(jobId, sku, urls) {
        const approvedUrls = urls.slice();
        const remoteIndexes = approvedUrls
            .map((url, index) => (/^https?:\/\//i.test(url) ? index : -1))
            .filter((index) => index >= 0);
        if (remoteIndexes.length === 0)
            return { urls: approvedUrls, s3Keys: [] };
        const preferredRemoteUrls = [];
        for (let start = 0; start < remoteIndexes.length; start += IMAGE_MIRROR_CONCURRENCY) {
            const indexes = remoteIndexes.slice(start, start + IMAGE_MIRROR_CONCURRENCY);
            preferredRemoteUrls.push(...(await Promise.all(indexes.map((index) => this.preferFullResolutionFebestUrl(approvedUrls[index])))));
        }
        if (!this.shouldMirror()) {
            remoteIndexes.forEach((index, position) => {
                approvedUrls[index] = preferredRemoteUrls[position];
            });
            return { urls: approvedUrls, s3Keys: [] };
        }
        const skuPart = sku.replace(/[^a-zA-Z0-9_-]/g, '_');
        const results = await this.storageService.mirrorRemoteImages(preferredRemoteUrls, `pipeline-images/${jobId.slice(0, 8)}/${skuPart}`, IMAGE_MIRROR_CONCURRENCY);
        remoteIndexes.forEach((index, position) => {
            approvedUrls[index] = results[position].url;
        });
        return {
            urls: approvedUrls,
            s3Keys: results
                .map((result) => result.s3Key)
                .filter((key) => Boolean(key)),
        };
    }
    async preferFullResolutionFebestUrl(url) {
        let candidate;
        try {
            candidate = new URL(url);
        }
        catch {
            return url;
        }
        if (candidate.hostname.toLowerCase() !== FEBEST_IMAGE_SOURCE_HOST) {
            return url;
        }
        const match = candidate.pathname.match(/^\/product_photos\/200\/(?:photos|schemes)\/[^/]+\.(?:jpe?g|png)$/i);
        if (!match)
            return url;
        candidate.pathname = candidate.pathname.replace('/product_photos/200/', '/product_photos/1600/');
        try {
            const response = await fetch(candidate, {
                method: 'HEAD',
                redirect: 'follow',
                signal: AbortSignal.timeout(10_000),
                headers: { 'User-Agent': 'OmniCore-catalog-import/1.0 (image check)' },
            });
            const contentType = response.headers.get('content-type')?.toLowerCase();
            return response.ok && contentType?.startsWith('image/')
                ? candidate.toString()
                : url;
        }
        catch {
            return url;
        }
    }
    async applyResolvedImagesToOutputDir(jobId, outputDir, imagesBySku) {
        if (!fs.existsSync(outputDir) || imagesBySku.size === 0) {
            return { filesUpdated: 0, rowsUpdated: 0 };
        }
        const files = fs
            .readdirSync(outputDir)
            .filter((file) => /\.(?:xlsx|csv)$/i.test(file) && !file.startsWith('~$'));
        let filesUpdated = 0;
        let rowsUpdated = 0;
        for (const file of files) {
            const fullPath = path.join(outputDir, file);
            const wb = XLSX.readFile(fullPath);
            const sheetName = wb.SheetNames.includes('Listings')
                ? 'Listings'
                : wb.SheetNames[0];
            const ws = sheetName ? wb.Sheets[sheetName] : undefined;
            if (!sheetName || !ws)
                continue;
            const rows = XLSX.utils.sheet_to_json(ws, {
                header: 1,
                defval: '',
            });
            const headerIdx = this.findHeaderRow(rows);
            if (headerIdx < 0)
                continue;
            const headers = rows[headerIdx].map((header) => String(header ?? '').trim());
            const skuIdx = this.colIdx(headers, 'customlabel');
            const titleIdx = this.colIdx(headers, 'title');
            const relationshipIdx = headers.findIndex((header) => /^relationship$/i.test(header));
            const imageColIdxs = headers
                .map((header, index) => (this.isImageColumn(header) ? index : -1))
                .filter((index) => index >= 0);
            if (skuIdx < 0 || titleIdx < 0 || imageColIdxs.length === 0)
                continue;
            let fileRowsUpdated = 0;
            for (let rowIdx = headerIdx + 1; rowIdx < rows.length; rowIdx++) {
                const row = rows[rowIdx];
                if (!row?.length || !String(row[titleIdx] ?? '').trim())
                    continue;
                if (relationshipIdx >= 0 &&
                    String(row[relationshipIdx] ?? '').trim() === 'Compatibility') {
                    continue;
                }
                const sku = String(row[skuIdx] ?? '').trim().toLowerCase();
                const resolvedUrls = imagesBySku.get(sku);
                if (!sku || !resolvedUrls?.length)
                    continue;
                const existingUrls = imageColIdxs.flatMap((columnIndex) => (0, pipeline_image_matching_util_js_1.parseImageUrlPipe)(String(row[columnIndex] ?? '')));
                const mergedUrls = (0, pipeline_image_matching_util_js_1.mergeImageUrls)(resolvedUrls, existingUrls);
                if (mergedUrls.join('|') === existingUrls.join('|'))
                    continue;
                while (row.length < headers.length)
                    row.push('');
                this.writeImageColumns(row, imageColIdxs, mergedUrls);
                fileRowsUpdated++;
            }
            if (fileRowsUpdated === 0)
                continue;
            this.writeRowsToFile(wb, sheetName, rows, fullPath);
            filesUpdated++;
            rowsUpdated += fileRowsUpdated;
        }
        this.logger.log('Job ' +
            jobId +
            ': Wrote resolved images to ' +
            rowsUpdated +
            ' output row(s) across ' +
            filesUpdated +
            ' file(s)');
        return { filesUpdated, rowsUpdated };
    }
    async mirrorImagesInWorkbook(jobId, filePath, skuConcurrency) {
        const wb = XLSX.readFile(filePath);
        const sheetName = wb.SheetNames.includes('Listings')
            ? 'Listings'
            : wb.SheetNames[0];
        if (!sheetName)
            return { mirrored: 0, rows: 0 };
        const ws = wb.Sheets[sheetName];
        if (!ws)
            return { mirrored: 0, rows: 0 };
        const rows = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: '',
        });
        const headerIdx = this.findHeaderRow(rows);
        if (headerIdx < 0) {
            this.logger.warn(`Job ${jobId}: No header row in ${path.basename(filePath)}`);
            return { mirrored: 0, rows: 0 };
        }
        const headers = rows[headerIdx].map((h) => String(h ?? '').trim());
        let s3ColIdx = headers.indexOf(S3_PATH_COLUMN);
        if (s3ColIdx < 0) {
            s3ColIdx = headers.length;
            headers.push(S3_PATH_COLUMN);
            rows[headerIdx] = headers;
        }
        const imageColIdxs = headers
            .map((h, i) => (this.isImageColumn(h) ? i : -1))
            .filter((i) => i >= 0);
        const iRelationship = headers.findIndex((h) => /^relationship$/i.test(h));
        const iSku = this.colIdx(headers, 'customlabel');
        const iTitle = this.colIdx(headers, 'title');
        const listingRowIndices = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row?.length)
                continue;
            const rel = iRelationship >= 0 ? String(row[iRelationship] ?? '').trim() : '';
            if (rel === 'Compatibility')
                continue;
            const title = iTitle >= 0 ? String(row[iTitle] ?? '').trim() : '';
            if (!title)
                continue;
            listingRowIndices.push(i);
        }
        let mirrored = 0;
        const mirrorRow = async (rowIdx) => {
            const row = rows[rowIdx];
            while (row.length < headers.length)
                row.push('');
            const urls = [];
            for (const col of imageColIdxs) {
                const v = String(row[col] ?? '').trim();
                if (!v)
                    continue;
                if (col === imageColIdxs[0] && v.includes('|')) {
                    urls.push(...v
                        .split('|')
                        .map((u) => u.trim())
                        .filter(Boolean));
                }
                else {
                    urls.push(v);
                }
            }
            const remoteUrls = urls.filter((u) => /^https?:\/\//i.test(u));
            if (remoteUrls.length === 0)
                return;
            const sku = iSku >= 0 ? String(row[iSku] ?? '').trim() : '';
            const skuPart = (sku || `row-${rowIdx}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            const ns = `pipeline-images/${jobId.slice(0, 8)}/${skuPart}`;
            try {
                const results = await this.storageService.mirrorRemoteImages(urls, ns, IMAGE_MIRROR_CONCURRENCY);
                const hadNewMirror = results.some((r) => r.s3Key != null);
                if (!hadNewMirror)
                    return;
                this.writeImageColumns(row, imageColIdxs, results.map((r) => r.url));
                row[s3ColIdx] = results
                    .map((r) => r.s3Key ?? '')
                    .filter(Boolean)
                    .join('|');
                mirrored++;
            }
            catch (err) {
                this.logger.warn(`Job ${jobId}: Image mirror failed row ${rowIdx} in ${path.basename(filePath)}: ${err instanceof Error ? err.message : err}`);
            }
        };
        for (let batch = 0; batch < listingRowIndices.length; batch += skuConcurrency) {
            const slice = listingRowIndices.slice(batch, batch + skuConcurrency);
            await Promise.all(slice.map((idx) => mirrorRow(idx)));
        }
        this.writeRowsToFile(wb, sheetName, rows, filePath);
        return { mirrored, rows: listingRowIndices.length };
    }
    writeRowsToFile(wb, sheetName, rows, filePath) {
        const outWs = XLSX.utils.aoa_to_sheet(rows);
        wb.Sheets[sheetName] = outWs;
        if (/\.csv$/i.test(filePath)) {
            fs.writeFileSync(filePath, XLSX.utils.sheet_to_csv(outWs), 'utf8');
            return;
        }
        XLSX.writeFile(wb, filePath);
    }
    findHeaderRow(rows) {
        for (let i = 0; i < Math.min(rows.length, 12); i++) {
            const row = rows[i];
            if (row?.some((h) => h && /title/i.test(String(h)) && !/info/i.test(String(h)))) {
                return i;
            }
        }
        return -1;
    }
    colIdx(headers, name) {
        const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return headers.findIndex((h) => h
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .includes(norm));
    }
    isImageColumn(header) {
        const h = String(header ?? '').trim();
        if (!h)
            return false;
        return IMAGE_COLUMN_PATTERNS.some((p) => p.test(h));
    }
    writeImageColumns(row, imageColIdxs, urls) {
        const trimmed = urls
            .map((u) => u.trim())
            .filter(Boolean)
            .slice(0, 24);
        for (let i = 0; i < imageColIdxs.length; i++) {
            row[imageColIdxs[i]] = trimmed[i] ?? '';
        }
    }
};
exports.PipelineOutputImageService = PipelineOutputImageService;
exports.PipelineOutputImageService = PipelineOutputImageService = PipelineOutputImageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [storage_service_js_1.StorageService,
        config_1.ConfigService])
], PipelineOutputImageService);
//# sourceMappingURL=pipeline-output-image.service.js.map