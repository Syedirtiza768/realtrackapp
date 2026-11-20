import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import type { User } from '../auth/entities/user.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { PartsSearchService } from './parts-search.service.js';
export type ImageSource = {
    kind: 'bucket';
    key: string;
    candidates: string[];
} | {
    kind: 'remote';
    url: string;
    fallbackUrl?: string;
};
export interface PartImage {
    index: number;
    previewUrl: string;
    filename: string;
    origin: 'omni-core-storage' | 'ebay' | 'partsbazar360' | 'web';
}
export declare function upgradeEbayUrl(url: string): string;
export declare function isPrivateAddress(address: string): boolean;
export declare class PartsSearchImagesService {
    private readonly partsSearch;
    private readonly storage;
    private readonly config;
    private readonly dataSource;
    private readonly userOrgs;
    private readonly logger;
    private readonly bucket;
    constructor(partsSearch: PartsSearchService, storage: StorageService, config: ConfigService, dataSource: DataSource, userOrgs: UserOrganizationService);
    resolve(raw: string): ImageSource | null;
    private bucketSource;
    private previewUrl;
    private originOf;
    private partImageUrls;
    listPartImages(partId: string): Promise<{
        partId: string;
        label: string;
        images: PartImage[];
    }>;
    downloadPartImage(partId: string, index: number, res: Response): Promise<void>;
    downloadPartZip(partId: string, res: Response): Promise<void>;
    downloadOmniImage(inventoryItemId: string, user: User, res: Response): Promise<void>;
    private send;
    fetchBest(source: ImageSource): Promise<{
        body: Buffer;
        contentType: string;
        ext: string;
    }>;
    private fetchRemote;
    private assertPublicHost;
    private readLimited;
    private typed;
}
