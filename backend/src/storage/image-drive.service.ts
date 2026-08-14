import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ImageDriveAsset } from './entities/image-drive-asset.entity.js';
import { ImageDriveFolder } from './entities/image-drive-folder.entity.js';
import { StorageService } from './storage.service.js';

export interface DriveFileEntry {
  id: string;
  folderId: string;
  filename: string;
  cdnUrl: string;
  s3Key: string;
  s3KeyThumb: string | null;
  s3KeyMedium: string | null;
  mimeType: string | null;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  createdAt: Date;
}

export interface DriveFolderEntry {
  id: string;
  name: string;
  s3Prefix: string;
  linkedPartNumber: string | null;
  fileCount: number;
  totalSizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrls: string[];
}

export interface BatchLookupResult {
  [partNumber: string]: DriveFileEntry[];
}

@Injectable()
export class ImageDriveService {
  private readonly logger = new Logger(ImageDriveService.name);

  constructor(
    @InjectRepository(ImageDriveFolder)
    private readonly folderRepo: Repository<ImageDriveFolder>,
    @InjectRepository(ImageDriveAsset)
    private readonly assetRepo: Repository<ImageDriveAsset>,
    private readonly storageService: StorageService,
  ) {}

  static normalizePartNumber(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[\s\-_./\\]+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  static normalizeFolderName(raw: string): string {
    return raw.trim().toLowerCase();
  }

  // ─── Folder operations ───────────────────────────────────────

  async listFolders(): Promise<DriveFolderEntry[]> {
    const folders = await this.folderRepo.find({
      order: { name: 'ASC' },
    });

    const entries: DriveFolderEntry[] = [];
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
        thumbnailUrls: thumbs.map((t) => t.s3KeyThumb || t.cdnUrl),
      });
    }

    return entries;
  }

  async createFolder(
    name: string,
    linkedPartNumber?: string,
  ): Promise<DriveFolderEntry> {
    const normalized = ImageDriveService.normalizeFolderName(name);
    const existing = await this.folderRepo.findOne({
      where: { nameNormalized: normalized },
    });
    if (existing) {
      throw new ConflictException(`Folder "${name}" already exists`);
    }

    const s3Prefix = this.storageService.buildDrivePrefix(name);

    const folder = this.folderRepo.create({
      name: name.trim(),
      nameNormalized: normalized,
      s3Prefix,
      linkedPartNumber: linkedPartNumber?.trim() || null,
      linkedPartNumberNormalized: linkedPartNumber
        ? ImageDriveService.normalizePartNumber(linkedPartNumber)
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

  async updateFolder(
    folderId: string,
    updates: { name?: string; linkedPartNumber?: string | null },
  ): Promise<DriveFolderEntry> {
    const folder = await this.folderRepo.findOne({
      where: { id: folderId },
      relations: ['assets'],
    });
    if (!folder) {
      throw new ConflictException(`Folder ${folderId} not found`);
    }

    if (updates.name !== undefined) {
      const normalized = ImageDriveService.normalizeFolderName(updates.name);
      const dup = await this.folderRepo.findOne({
        where: { nameNormalized: normalized },
      });
      if (dup && dup.id !== folderId) {
        throw new ConflictException(`Folder "${updates.name}" already exists`);
      }

      const oldPrefix = folder.s3Prefix;
      const newPrefix = this.storageService.buildDrivePrefix(updates.name);

      if (oldPrefix !== newPrefix && folder.assets.length > 0) {
        this.logger.log(
          `Moving ${folder.assets.length} S3 objects from ${oldPrefix} → ${newPrefix}`,
        );
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
              await this.storageService.moveObject(
                asset.s3KeyThumb,
                newThumbKey,
              );
              asset.s3KeyThumb = newThumbKey;
            }
            if (asset.s3KeyMedium) {
              const medFilename = asset.s3KeyMedium.slice(oldPrefix.length);
              const newMedKey = `${newPrefix}${medFilename}`;
              await this.storageService.moveObject(
                asset.s3KeyMedium,
                newMedKey,
              );
              asset.s3KeyMedium = newMedKey;
            }

            await this.assetRepo.save(asset);
          } catch (err) {
            this.logger.error(
              `Failed to move S3 object ${asset.s3Key} → ${newS3Key}: ${err}`,
            );
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
        ? ImageDriveService.normalizePartNumber(updates.linkedPartNumber)
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
      thumbnailUrls: thumbAssets.map((t) => t.s3KeyThumb || t.cdnUrl),
    };
  }

  async deleteFolder(folderId: string): Promise<void> {
    const folder = await this.folderRepo.findOne({
      where: { id: folderId },
      relations: ['assets'],
    });
    if (!folder) return;

    for (const asset of folder.assets) {
      await this.storageService.deleteObject(asset.s3Key).catch(() => {});
      if (asset.s3KeyThumb) {
        await this.storageService
          .deleteObject(asset.s3KeyThumb)
          .catch(() => {});
      }
      if (asset.s3KeyMedium) {
        await this.storageService
          .deleteObject(asset.s3KeyMedium)
          .catch(() => {});
      }
    }

    await this.folderRepo.remove(folder);
    this.logger.log(
      `Deleted folder "${folder.name}" with ${folder.assets.length} files`,
    );
  }

  async getFolder(folderId: string): Promise<DriveFolderEntry | null> {
    const folder = await this.folderRepo.findOneBy({ id: folderId });
    if (!folder) return null;

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

  async findOrCreateFolder(
    name: string,
    linkedPartNumber?: string,
  ): Promise<DriveFolderEntry> {
    const normalized = ImageDriveService.normalizeFolderName(name);
    const existing = await this.folderRepo.findOne({
      where: { nameNormalized: normalized },
    });
    if (existing) {
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

  // ─── File operations ─────────────────────────────────────────

  async listFiles(
    folderId: string,
    page = 1,
    limit = 50,
  ): Promise<{
    items: DriveFileEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
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

  async addFile(
    folderId: string,
    data: {
      filename: string;
      s3Key: string;
      cdnUrl: string;
      mimeType: string;
      fileSizeBytes: number;
    },
  ): Promise<DriveFileEntry> {
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

  async updateFileVariants(
    assetId: string,
    variants: {
      s3KeyThumb?: string | null;
      s3KeyMedium?: string | null;
      width?: number | null;
      height?: number | null;
      blurhash?: string | null;
    },
  ): Promise<void> {
    await this.assetRepo.update(assetId, variants);
  }

  async deleteFile(assetId: string): Promise<boolean> {
    const asset = await this.assetRepo.findOneBy({ id: assetId });
    if (!asset) return false;

    await this.storageService.deleteObject(asset.s3Key).catch(() => {});
    if (asset.s3KeyThumb) {
      await this.storageService.deleteObject(asset.s3KeyThumb).catch(() => {});
    }
    if (asset.s3KeyMedium) {
      await this.storageService.deleteObject(asset.s3KeyMedium).catch(() => {});
    }

    await this.assetRepo.softDelete(assetId);

    await this.folderRepo
      .createQueryBuilder()
      .update()
      .set({
        fileCount: () => 'GREATEST("file_count" - 1, 0)',
        totalSizeBytes: () =>
          `GREATEST("total_size_bytes" - ${asset.fileSizeBytes}, 0)`,
      })
      .where('id = :id', { id: asset.folderId })
      .execute();

    return true;
  }

  async getFile(assetId: string): Promise<DriveFileEntry | null> {
    const asset = await this.assetRepo.findOneBy({ id: assetId });
    if (!asset) return null;
    return this.toFileEntry(asset);
  }

  async deleteFiles(
    assetIds: string[],
  ): Promise<{ deleted: number; failed: string[] }> {
    const failed: string[] = [];
    let deleted = 0;

    for (const assetId of assetIds) {
      try {
        const ok = await this.deleteFile(assetId);
        if (ok) deleted++;
        else failed.push(assetId);
      } catch {
        failed.push(assetId);
      }
    }

    return { deleted, failed };
  }

  // ─── Part number lookup (for auto-attach) ────────────────────

  async findByPartNumber(partNumber: string): Promise<DriveFileEntry[]> {
    const normalized = ImageDriveService.normalizePartNumber(partNumber);
    if (!normalized) return [];

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

  async findByPartNumbers(partNumbers: string[]): Promise<BatchLookupResult> {
    const normalizedSet = new Map<string, string>();
    for (const raw of partNumbers) {
      const norm = ImageDriveService.normalizePartNumber(raw);
      if (norm) normalizedSet.set(norm, raw);
    }

    if (normalizedSet.size === 0) return {};

    const normalizedKeys = [...normalizedSet.keys()];

    const linkedFolders = await this.folderRepo.find({
      where: { linkedPartNumberNormalized: In(normalizedKeys) },
    });

    const nameFolders = await this.folderRepo.find({
      where: { nameNormalized: In(normalizedKeys) },
    });

    const allFolders = [...linkedFolders, ...nameFolders];
    const uniqueFolders = new Map<string, ImageDriveFolder>();
    for (const f of allFolders) {
      uniqueFolders.set(f.id, f);
    }

    const folderIds = [...uniqueFolders.values()].map((f) => f.id);
    if (folderIds.length === 0) return {};

    const assets = await this.assetRepo.find({
      where: { folderId: In(folderIds) },
      order: { createdAt: 'ASC' },
      withDeleted: false,
    });

    const folderToAssets = new Map<string, DriveFileEntry[]>();
    for (const asset of assets) {
      if (!folderToAssets.has(asset.folderId)) {
        folderToAssets.set(asset.folderId, []);
      }
      folderToAssets.get(asset.folderId)!.push(this.toFileEntry(asset));
    }

    const result: BatchLookupResult = {};
    for (const [norm, raw] of normalizedSet) {
      const folder =
        linkedFolders.find((f) => f.linkedPartNumberNormalized === norm) ||
        nameFolders.find((f) => f.nameNormalized === norm);

      if (folder) {
        result[norm] = folderToAssets.get(folder.id) ?? [];
      }
    }

    return result;
  }

  // ─── Search ──────────────────────────────────────────────────

  async search(
    query: string,
    page = 1,
    limit = 50,
  ): Promise<{
    items: Array<DriveFileEntry & { folderName: string }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    const normalized = ImageDriveService.normalizePartNumber(query);

    const qb = this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.folder', 'f')
      .where(
        `f.name_normalized LIKE :q OR f.linked_part_number_normalized LIKE :q`,
        { q: `%${normalized}%` },
      );

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

  // ─── Stats ───────────────────────────────────────────────────

  async getStats(): Promise<{
    totalFolders: number;
    totalFiles: number;
    totalSizeBytes: number;
  }> {
    const totalFolders = await this.folderRepo.count();
    const totalFiles = await this.assetRepo.count();
    const result = await this.assetRepo
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.file_size_bytes), 0)', 'total')
      .getRawOne();
    const totalSizeBytes = parseInt(result?.total ?? '0', 10);

    return { totalFolders, totalFiles, totalSizeBytes };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private toFileEntry(asset: ImageDriveAsset): DriveFileEntry {
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
}
