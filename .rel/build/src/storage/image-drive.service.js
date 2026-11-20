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
var ImageDriveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageDriveService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const image_drive_asset_entity_js_1 = require("./entities/image-drive-asset.entity.js");
const image_drive_folder_entity_js_1 = require("./entities/image-drive-folder.entity.js");
const storage_service_js_1 = require("./storage.service.js");
let ImageDriveService = ImageDriveService_1 = class ImageDriveService {
    folderRepo;
    assetRepo;
    storageService;
    logger = new common_1.Logger(ImageDriveService_1.name);
    constructor(folderRepo, assetRepo, storageService) {
        this.folderRepo = folderRepo;
        this.assetRepo = assetRepo;
        this.storageService = storageService;
    }
    static normalizePartNumber(raw) {
        return raw
            .trim()
            .toLowerCase()
            .replace(/[\s\-_./\\]+/g, '')
            .replace(/[^a-z0-9]/g, '');
    }
    static normalizeFolderName(raw) {
        return raw.trim().toLowerCase();
    }
    async listFolders() {
        const folders = await this.folderRepo.find({
            order: { name: 'ASC' },
        });
        const entries = [];
        for (const folder of folders) {
            const thumbs = await this.assetRepo.find({
                where: { folderId: folder.id },
                order: { createdAt: 'ASC' },
                take: 4,
                withDeleted: false,
            });
            entries.push({
                id: folder.id,
                name: folder.name,
                s3Prefix: folder.s3Prefix,
                linkedPartNumber: folder.linkedPartNumber,
                fileCount: folder.fileCount,
                totalSizeBytes: folder.totalSizeBytes,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
                thumbnailUrls: thumbs.map((t) => t.s3KeyThumb ? this.storageService.getCdnUrl(t.s3KeyThumb) : t.cdnUrl),
            });
        }
        return entries;
    }
    async createFolder(name, linkedPartNumber) {
        const normalized = ImageDriveService_1.normalizeFolderName(name);
        const existing = await this.folderRepo.findOne({
            where: { nameNormalized: normalized },
        });
        if (existing) {
            throw new common_1.ConflictException(`Folder "${name}" already exists`);
        }
        const s3Prefix = this.storageService.buildDrivePrefix(name);
        const folder = this.folderRepo.create({
            name: name.trim(),
            nameNormalized: normalized,
            s3Prefix,
            linkedPartNumber: linkedPartNumber?.trim() || null,
            linkedPartNumberNormalized: linkedPartNumber
                ? ImageDriveService_1.normalizePartNumber(linkedPartNumber)
                : null,
        });
        const saved = await this.folderRepo.save(folder);
        this.logger.log(`Created folder "${name}" (id=${saved.id})`);
        return {
            id: saved.id,
            name: saved.name,
            s3Prefix: saved.s3Prefix,
            linkedPartNumber: saved.linkedPartNumber,
            fileCount: 0,
            totalSizeBytes: 0,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            thumbnailUrls: [],
        };
    }
    async updateFolder(folderId, updates) {
        const folder = await this.folderRepo.findOne({
            where: { id: folderId },
            relations: ['assets'],
        });
        if (!folder) {
            throw new common_1.ConflictException(`Folder ${folderId} not found`);
        }
        if (updates.name !== undefined) {
            const normalized = ImageDriveService_1.normalizeFolderName(updates.name);
            const dup = await this.folderRepo.findOne({
                where: { nameNormalized: normalized },
            });
            if (dup && dup.id !== folderId) {
                throw new common_1.ConflictException(`Folder "${updates.name}" already exists`);
            }
            const oldPrefix = folder.s3Prefix;
            const newPrefix = this.storageService.buildDrivePrefix(updates.name);
            if (oldPrefix !== newPrefix && folder.assets.length > 0) {
                this.logger.log(`Moving ${folder.assets.length} S3 objects from ${oldPrefix} → ${newPrefix}`);
                for (const asset of folder.assets) {
                    const filenames = asset.s3Key.slice(oldPrefix.length);
                    const newS3Key = `${newPrefix}${filenames}`;
                    try {
                        await this.storageService.moveObject(asset.s3Key, newS3Key);
                        asset.s3Key = newS3Key;
                        asset.cdnUrl = this.storageService.getCdnUrl(newS3Key);
                        if (asset.s3KeyThumb) {
                            const thumbFilename = asset.s3KeyThumb.slice(oldPrefix.length);
                            const newThumbKey = `${newPrefix}${thumbFilename}`;
                            await this.storageService.moveObject(asset.s3KeyThumb, newThumbKey);
                            asset.s3KeyThumb = newThumbKey;
                        }
                        if (asset.s3KeyMedium) {
                            const medFilename = asset.s3KeyMedium.slice(oldPrefix.length);
                            const newMedKey = `${newPrefix}${medFilename}`;
                            await this.storageService.moveObject(asset.s3KeyMedium, newMedKey);
                            asset.s3KeyMedium = newMedKey;
                        }
                        await this.assetRepo.save(asset);
                    }
                    catch (err) {
                        this.logger.error(`Failed to move S3 object ${asset.s3Key} → ${newS3Key}: ${err}`);
                    }
                }
            }
            folder.name = updates.name.trim();
            folder.nameNormalized = normalized;
            folder.s3Prefix = newPrefix;
        }
        if (updates.linkedPartNumber !== undefined) {
            folder.linkedPartNumber = updates.linkedPartNumber?.trim() || null;
            folder.linkedPartNumberNormalized = updates.linkedPartNumber
                ? ImageDriveService_1.normalizePartNumber(updates.linkedPartNumber)
                : null;
        }
        const saved = await this.folderRepo.save(folder);
        this.logger.log(`Updated folder ${folderId}`);
        const thumbAssets = await this.assetRepo.find({
            where: { folderId },
            order: { createdAt: 'ASC' },
            take: 4,
            withDeleted: false,
        });
        return {
            id: saved.id,
            name: saved.name,
            s3Prefix: saved.s3Prefix,
            linkedPartNumber: saved.linkedPartNumber,
            fileCount: saved.fileCount,
            totalSizeBytes: saved.totalSizeBytes,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            thumbnailUrls: thumbAssets.map((t) => t.s3KeyThumb ? this.storageService.getCdnUrl(t.s3KeyThumb) : t.cdnUrl),
        };
    }
    async deleteFolder(folderId) {
        const folder = await this.folderRepo.findOne({
            where: { id: folderId },
            relations: ['assets'],
        });
        if (!folder)
            return;
        for (const asset of folder.assets) {
            await this.storageService.deleteObject(asset.s3Key).catch(() => { });
            if (asset.s3KeyThumb) {
                await this.storageService
                    .deleteObject(asset.s3KeyThumb)
                    .catch(() => { });
            }
            if (asset.s3KeyMedium) {
                await this.storageService
                    .deleteObject(asset.s3KeyMedium)
                    .catch(() => { });
            }
        }
        await this.folderRepo.remove(folder);
        this.logger.log(`Deleted folder "${folder.name}" with ${folder.assets.length} files`);
    }
    async getFolder(folderId) {
        const folder = await this.folderRepo.findOneBy({ id: folderId });
        if (!folder)
            return null;
        return {
            id: folder.id,
            name: folder.name,
            s3Prefix: folder.s3Prefix,
            linkedPartNumber: folder.linkedPartNumber,
            fileCount: folder.fileCount,
            totalSizeBytes: folder.totalSizeBytes,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
            thumbnailUrls: [],
        };
    }
    async findOrCreateFolder(name, linkedPartNumber) {
        const normalized = ImageDriveService_1.normalizeFolderName(name);
        const existing = await this.folderRepo.findOne({
            where: { nameNormalized: normalized },
        });
        if (existing) {
            if (linkedPartNumber?.trim() && !existing.linkedPartNumberNormalized) {
                existing.linkedPartNumber = linkedPartNumber.trim();
                existing.linkedPartNumberNormalized =
                    ImageDriveService_1.normalizePartNumber(linkedPartNumber);
                await this.folderRepo.save(existing);
            }
            return {
                id: existing.id,
                name: existing.name,
                s3Prefix: existing.s3Prefix,
                linkedPartNumber: existing.linkedPartNumber,
                fileCount: existing.fileCount,
                totalSizeBytes: existing.totalSizeBytes,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
                thumbnailUrls: [],
            };
        }
        return this.createFolder(name, linkedPartNumber);
    }
    async listFiles(folderId, page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const [assets, total] = await this.assetRepo.findAndCount({
            where: { folderId },
            order: { createdAt: 'ASC' },
            skip: offset,
            take: limit,
            withDeleted: false,
        });
        return {
            items: assets.map(this.toFileEntry),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async addFile(folderId, data) {
        const asset = this.assetRepo.create({
            folderId,
            filename: data.filename,
            s3Key: data.s3Key,
            cdnUrl: data.cdnUrl,
            mimeType: data.mimeType,
            fileSizeBytes: data.fileSizeBytes,
        });
        const saved = await this.assetRepo.save(asset);
        await this.folderRepo
            .createQueryBuilder()
            .update()
            .set({
            fileCount: () => '"file_count" + 1',
            totalSizeBytes: () => `"total_size_bytes" + ${data.fileSizeBytes}`,
        })
            .where('id = :id', { id: folderId })
            .execute();
        return this.toFileEntry(saved);
    }
    async addFileIfMissing(folderId, data) {
        const existing = await this.assetRepo.findOne({
            where: { folderId, s3Key: data.s3Key },
            withDeleted: false,
        });
        if (existing) {
            return { entry: this.toFileEntry(existing), created: false };
        }
        try {
            return {
                entry: await this.addFile(folderId, data),
                created: true,
            };
        }
        catch (error) {
            const concurrent = await this.assetRepo.findOne({
                where: { folderId, s3Key: data.s3Key },
                withDeleted: false,
            });
            if (concurrent) {
                return { entry: this.toFileEntry(concurrent), created: false };
            }
            throw error;
        }
    }
    async updateFileVariants(assetId, variants) {
        await this.assetRepo.update(assetId, variants);
    }
    async deleteFile(assetId) {
        const asset = await this.assetRepo.findOneBy({ id: assetId });
        if (!asset)
            return false;
        await this.storageService.deleteObject(asset.s3Key).catch(() => { });
        if (asset.s3KeyThumb) {
            await this.storageService.deleteObject(asset.s3KeyThumb).catch(() => { });
        }
        if (asset.s3KeyMedium) {
            await this.storageService.deleteObject(asset.s3KeyMedium).catch(() => { });
        }
        await this.assetRepo.softDelete(assetId);
        await this.folderRepo
            .createQueryBuilder()
            .update()
            .set({
            fileCount: () => 'GREATEST("file_count" - 1, 0)',
            totalSizeBytes: () => `GREATEST("total_size_bytes" - ${asset.fileSizeBytes}, 0)`,
        })
            .where('id = :id', { id: asset.folderId })
            .execute();
        return true;
    }
    async getFile(assetId) {
        const asset = await this.assetRepo.findOneBy({ id: assetId });
        if (!asset)
            return null;
        return this.toFileEntry(asset);
    }
    async deleteFiles(assetIds) {
        const failed = [];
        let deleted = 0;
        for (const assetId of assetIds) {
            try {
                const ok = await this.deleteFile(assetId);
                if (ok)
                    deleted++;
                else
                    failed.push(assetId);
            }
            catch {
                failed.push(assetId);
            }
        }
        return { deleted, failed };
    }
    async findByPartNumber(partNumber) {
        const normalized = ImageDriveService_1.normalizePartNumber(partNumber);
        if (!normalized)
            return [];
        const folder = await this.folderRepo.findOne({
            where: { linkedPartNumberNormalized: normalized },
        });
        if (folder) {
            const assets = await this.assetRepo.find({
                where: { folderId: folder.id },
                order: { createdAt: 'ASC' },
                withDeleted: false,
            });
            return assets.map(this.toFileEntry);
        }
        const nameMatch = await this.folderRepo.findOne({
            where: { nameNormalized: normalized },
        });
        if (nameMatch) {
            const assets = await this.assetRepo.find({
                where: { folderId: nameMatch.id },
                order: { createdAt: 'ASC' },
                withDeleted: false,
            });
            return assets.map(this.toFileEntry);
        }
        return [];
    }
    async findByPartNumbers(partNumbers) {
        const normalizedSet = new Map();
        for (const raw of partNumbers) {
            const norm = ImageDriveService_1.normalizePartNumber(raw);
            if (norm)
                normalizedSet.set(norm, raw);
        }
        if (normalizedSet.size === 0)
            return {};
        const normalizedKeys = [...normalizedSet.keys()];
        const linkedFolders = await this.folderRepo.find({
            where: { linkedPartNumberNormalized: (0, typeorm_2.In)(normalizedKeys) },
        });
        const nameFolders = await this.folderRepo.find({
            where: { nameNormalized: (0, typeorm_2.In)(normalizedKeys) },
        });
        const allFolders = [...linkedFolders, ...nameFolders];
        const uniqueFolders = new Map();
        for (const f of allFolders) {
            uniqueFolders.set(f.id, f);
        }
        const folderIds = [...uniqueFolders.values()].map((f) => f.id);
        if (folderIds.length === 0)
            return {};
        const assets = await this.assetRepo.find({
            where: { folderId: (0, typeorm_2.In)(folderIds) },
            order: { createdAt: 'ASC' },
            withDeleted: false,
        });
        const folderToAssets = new Map();
        for (const asset of assets) {
            if (!folderToAssets.has(asset.folderId)) {
                folderToAssets.set(asset.folderId, []);
            }
            folderToAssets.get(asset.folderId).push(this.toFileEntry(asset));
        }
        const result = {};
        for (const [norm, raw] of normalizedSet) {
            const folder = linkedFolders.find((f) => f.linkedPartNumberNormalized === norm) ||
                nameFolders.find((f) => f.nameNormalized === norm);
            if (folder) {
                result[norm] = folderToAssets.get(folder.id) ?? [];
            }
        }
        return result;
    }
    async search(query, page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const normalized = ImageDriveService_1.normalizePartNumber(query);
        const qb = this.assetRepo
            .createQueryBuilder('a')
            .leftJoinAndSelect('a.folder', 'f')
            .where(`f.name_normalized LIKE :q OR f.linked_part_number_normalized LIKE :q`, { q: `%${normalized}%` });
        const total = await qb.getCount();
        const assets = await qb
            .orderBy('a.created_at', 'DESC')
            .skip(offset)
            .take(limit)
            .getMany();
        return {
            items: assets.map((a) => ({
                ...this.toFileEntry(a),
                folderName: a.folder?.name ?? '',
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getStats() {
        const totalFolders = await this.folderRepo.count();
        const totalFiles = await this.assetRepo.count();
        const result = await this.assetRepo
            .createQueryBuilder('a')
            .select('COALESCE(SUM(a.file_size_bytes), 0)', 'total')
            .getRawOne();
        const totalSizeBytes = parseInt(result?.total ?? '0', 10);
        return { totalFolders, totalFiles, totalSizeBytes };
    }
    toFileEntry(asset) {
        return {
            id: asset.id,
            folderId: asset.folderId,
            filename: asset.filename,
            cdnUrl: asset.cdnUrl,
            s3Key: asset.s3Key,
            s3KeyThumb: asset.s3KeyThumb,
            s3KeyMedium: asset.s3KeyMedium,
            mimeType: asset.mimeType,
            fileSizeBytes: asset.fileSizeBytes,
            width: asset.width,
            height: asset.height,
            blurhash: asset.blurhash,
            createdAt: asset.createdAt,
        };
    }
};
exports.ImageDriveService = ImageDriveService;
exports.ImageDriveService = ImageDriveService = ImageDriveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(image_drive_folder_entity_js_1.ImageDriveFolder)),
    __param(1, (0, typeorm_1.InjectRepository)(image_drive_asset_entity_js_1.ImageDriveAsset)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        storage_service_js_1.StorageService])
], ImageDriveService);
//# sourceMappingURL=image-drive.service.js.map