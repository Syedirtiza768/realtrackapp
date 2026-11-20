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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageDriveController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const image_drive_service_js_1 = require("./image-drive.service.js");
const storage_service_js_1 = require("./storage.service.js");
const upload_limits_js_1 = require("./upload-limits.js");
const image_drive_dto_js_1 = require("./dto/image-drive.dto.js");
const image_drive_folder_upload_util_js_1 = require("./utils/image-drive-folder-upload.util.js");
let ImageDriveController = class ImageDriveController {
    imageDriveService;
    storageService;
    constructor(imageDriveService, storageService) {
        this.imageDriveService = imageDriveService;
        this.storageService = storageService;
    }
    async listFolders() {
        return this.imageDriveService.listFolders();
    }
    async createFolder(dto) {
        if (!dto.name?.trim()) {
            throw new common_1.BadRequestException('Folder name is required');
        }
        return this.imageDriveService.createFolder(dto.name, dto.linkedPartNumber);
    }
    async updateFolder(folderId, dto) {
        return this.imageDriveService.updateFolder(folderId, {
            name: dto.name,
            linkedPartNumber: dto.linkedPartNumber,
        });
    }
    async deleteFolder(folderId) {
        await this.imageDriveService.deleteFolder(folderId);
        return { deleted: true };
    }
    async listFiles(folderId, query) {
        return this.imageDriveService.listFiles(folderId, query.page ?? 1, query.limit ?? 50);
    }
    async uploadToFolder(folderId, files) {
        if (!files?.length) {
            throw new common_1.BadRequestException('At least one file is required');
        }
        const folder = await this.imageDriveService.getFolder(folderId);
        if (!folder) {
            throw new common_1.NotFoundException(`Folder ${folderId} not found`);
        }
        const uploaded = [];
        for (const file of files) {
            const mimeType = file.mimetype || 'image/jpeg';
            const s3Key = `${folder.s3Prefix}${file.originalname}`;
            await this.storageService.putObject(s3Key, file.buffer, mimeType);
            const cdnUrl = this.storageService.getCdnUrl(s3Key);
            const entry = await this.imageDriveService.addFile(folderId, {
                filename: file.originalname,
                s3Key,
                cdnUrl,
                mimeType,
                fileSizeBytes: file.size,
            });
            this.storageService
                .queueDriveVariantGeneration(entry.id, s3Key)
                .catch((err) => this.storageService['logger']?.warn?.(`Variant queue failed for ${s3Key}: ${err}`));
            uploaded.push({
                filename: file.originalname,
                cdnUrl,
                s3Key,
                fileSizeBytes: file.size,
            });
        }
        return { uploaded: uploaded.length, files: uploaded };
    }
    async uploadAutoCreate(files, folderId, folderName, partNumber) {
        if (!files?.length) {
            throw new common_1.BadRequestException('At least one file is required');
        }
        let resolvedFolderId = folderId;
        if (folderId === 'auto' || !folderId) {
            if (!folderName?.trim()) {
                throw new common_1.BadRequestException('folderName is required when folderId is "auto"');
            }
            const folder = await this.imageDriveService.findOrCreateFolder(folderName, partNumber);
            resolvedFolderId = folder.id;
        }
        const folder = await this.imageDriveService.getFolder(resolvedFolderId);
        if (!folder) {
            throw new common_1.NotFoundException(`Folder ${resolvedFolderId} not found`);
        }
        const uploaded = [];
        for (const file of files) {
            const mimeType = file.mimetype || 'image/jpeg';
            const s3Key = `${folder.s3Prefix}${file.originalname}`;
            await this.storageService.putObject(s3Key, file.buffer, mimeType);
            const cdnUrl = this.storageService.getCdnUrl(s3Key);
            const entry = await this.imageDriveService.addFile(resolvedFolderId, {
                filename: file.originalname,
                s3Key,
                cdnUrl,
                mimeType,
                fileSizeBytes: file.size,
            });
            this.storageService
                .queueDriveVariantGeneration(entry.id, s3Key)
                .catch(() => { });
            uploaded.push({ filename: file.originalname, cdnUrl, s3Key });
        }
        return {
            folderId: resolvedFolderId,
            folderName: folder.name,
            uploaded: uploaded.length,
            files: uploaded,
        };
    }
    async uploadFolderTree(files, rawFilePaths, topLevelFolderName) {
        if (!files?.length) {
            throw new common_1.BadRequestException('At least one image file is required');
        }
        let filePaths;
        try {
            filePaths = JSON.parse(rawFilePaths || '[]');
        }
        catch {
            throw new common_1.BadRequestException('filePaths must be a JSON array');
        }
        if (!Array.isArray(filePaths) ||
            filePaths.length !== files.length ||
            filePaths.some((path) => typeof path !== 'string')) {
            throw new common_1.BadRequestException('filePaths must contain one relative path for every uploaded file');
        }
        const folderCache = new Map();
        const folderSummary = new Map();
        let uploaded = 0;
        let skipped = 0;
        let unassigned = 0;
        for (const [index, file] of files.entries()) {
            const resolved = (0, image_drive_folder_upload_util_js_1.resolveFolderUploadPath)(filePaths[index], topLevelFolderName || undefined);
            if (!resolved ||
                !(0, image_drive_folder_upload_util_js_1.isSupportedImageUpload)(file.originalname, file.mimetype)) {
                skipped++;
                continue;
            }
            const targetFolderName = resolved.partNumber || resolved.topLevelFolderName;
            const folderKey = resolved.partNumber
                ? `part:${image_drive_service_js_1.ImageDriveService.normalizePartNumber(resolved.partNumber)}`
                : `root:${image_drive_service_js_1.ImageDriveService.normalizeFolderName(targetFolderName)}`;
            let folder = folderCache.get(folderKey);
            if (!folder) {
                folder = await this.imageDriveService.findOrCreateFolder(targetFolderName, resolved.partNumber || undefined);
                folderCache.set(folderKey, folder);
            }
            if (!resolved.partNumber)
                unassigned++;
            const mimeType = file.mimetype || 'image/jpeg';
            const s3Key = `${folder.s3Prefix}${resolved.assetPath}`;
            await this.storageService.putObject(s3Key, file.buffer, mimeType);
            const cdnUrl = this.storageService.getCdnUrl(s3Key);
            const result = await this.imageDriveService.addFileIfMissing(folder.id, {
                filename: resolved.assetPath,
                s3Key,
                cdnUrl,
                mimeType,
                fileSizeBytes: file.size,
            });
            if (result.created) {
                uploaded++;
                this.storageService
                    .queueDriveVariantGeneration(result.entry.id, s3Key)
                    .catch((err) => this.storageService['logger']?.warn?.(`Folder-upload variant queue failed for ${s3Key}: ${err}`));
            }
            else {
                skipped++;
            }
            const summary = folderSummary.get(folderKey) || {
                folderName: folder.name,
                partNumber: resolved.partNumber,
                uploaded: 0,
            };
            if (result.created)
                summary.uploaded++;
            folderSummary.set(folderKey, summary);
        }
        return {
            uploaded,
            skipped,
            unassigned,
            folders: [...folderSummary.values()],
        };
    }
    async deleteFile(fileId) {
        const removed = await this.imageDriveService.deleteFile(fileId);
        if (!removed) {
            throw new common_1.NotFoundException(`File ${fileId} not found`);
        }
        return { deleted: true };
    }
    async getFile(fileId) {
        const file = await this.imageDriveService.getFile(fileId);
        if (!file) {
            throw new common_1.NotFoundException(`File ${fileId} not found`);
        }
        return file;
    }
    async bulkDeleteFiles(dto) {
        if (!dto.fileIds?.length) {
            throw new common_1.BadRequestException('fileIds array is required');
        }
        return this.imageDriveService.deleteFiles(dto.fileIds);
    }
    async findByPartNumber(partNumber) {
        const images = await this.imageDriveService.findByPartNumber(partNumber);
        return { partNumber, images, count: images.length };
    }
    async batchLookup(dto) {
        if (!dto.partNumbers?.length) {
            throw new common_1.BadRequestException('partNumbers array is required');
        }
        const result = await this.imageDriveService.findByPartNumbers(dto.partNumbers);
        const summary = dto.partNumbers.map((pn) => {
            const normalized = image_drive_service_js_1.ImageDriveService.normalizePartNumber(pn);
            const images = result[normalized] ?? [];
            return { partNumber: pn, count: images.length };
        });
        return { results: result, summary };
    }
    async search(query) {
        if (!query.q?.trim()) {
            throw new common_1.BadRequestException('q (query) is required');
        }
        return this.imageDriveService.search(query.q, query.page ?? 1, query.limit ?? 50);
    }
    async getStats() {
        return this.imageDriveService.getStats();
    }
};
exports.ImageDriveController = ImageDriveController;
__decorate([
    (0, common_1.Get)('folders'),
    (0, swagger_1.ApiOperation)({ summary: 'List all folders' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "listFolders", null);
__decorate([
    (0, common_1.Post)('folders'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new folder' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [image_drive_dto_js_1.CreateFolderDto]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "createFolder", null);
__decorate([
    (0, common_1.Patch)('folders/:folderId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update folder name or linked part number' }),
    __param(0, (0, common_1.Param)('folderId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, image_drive_dto_js_1.UpdateFolderDto]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "updateFolder", null);
__decorate([
    (0, common_1.Delete)('folders/:folderId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a folder and all its files' }),
    __param(0, (0, common_1.Param)('folderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "deleteFolder", null);
__decorate([
    (0, common_1.Get)('folders/:folderId/files'),
    (0, swagger_1.ApiOperation)({ summary: 'List files in a folder' }),
    __param(0, (0, common_1.Param)('folderId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, image_drive_dto_js_1.ListFilesDto]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "listFiles", null);
__decorate([
    (0, common_1.Post)('folders/:folderId/upload'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 50, upload_limits_js_1.IMAGE_UPLOAD_MULTER_OPTIONS)),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload files to a folder' }),
    __param(0, (0, common_1.Param)('folderId')),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "uploadToFolder", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 50, upload_limits_js_1.IMAGE_UPLOAD_MULTER_OPTIONS)),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload files with auto-create folder. If folderId="auto", creates folder from folderName.',
    }),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('folderId')),
    __param(2, (0, common_1.Body)('folderName')),
    __param(3, (0, common_1.Body)('partNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String, String, String]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "uploadAutoCreate", null);
__decorate([
    (0, common_1.Post)('upload-folder'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 50, upload_limits_js_1.IMAGE_UPLOAD_MULTER_OPTIONS)),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload a folder tree and map part-number directories to Image Drive folders',
    }),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('filePaths')),
    __param(2, (0, common_1.Body)('topLevelFolderName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String, String]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "uploadFolderTree", null);
__decorate([
    (0, common_1.Delete)('files/:fileId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a single file' }),
    __param(0, (0, common_1.Param)('fileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "deleteFile", null);
__decorate([
    (0, common_1.Get)('files/:fileId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get single file details' }),
    __param(0, (0, common_1.Param)('fileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "getFile", null);
__decorate([
    (0, common_1.Post)('files/bulk-delete'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk delete files by IDs' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [image_drive_dto_js_1.BulkDeleteFilesDto]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "bulkDeleteFiles", null);
__decorate([
    (0, common_1.Get)('lookup/:partNumber'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all images for a part number' }),
    __param(0, (0, common_1.Param)('partNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "findByPartNumber", null);
__decorate([
    (0, common_1.Post)('lookup'),
    (0, swagger_1.ApiOperation)({ summary: 'Batch lookup images by part numbers' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [image_drive_dto_js_1.ImageDriveBatchLookupDto]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "batchLookup", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Search Image Drive by folder name or part number' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [image_drive_dto_js_1.SearchDriveDto]),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Image Drive statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ImageDriveController.prototype, "getStats", null);
exports.ImageDriveController = ImageDriveController = __decorate([
    (0, swagger_1.ApiTags)('Image Drive'),
    (0, common_1.Controller)('image-drive'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('image_drive.view'),
    __metadata("design:paramtypes", [image_drive_service_js_1.ImageDriveService,
        storage_service_js_1.StorageService])
], ImageDriveController);
//# sourceMappingURL=image-drive.controller.js.map