import { ImageDriveAsset } from './image-drive-asset.entity.js';
export declare class ImageDriveFolder {
    id: string;
    name: string;
    nameNormalized: string;
    s3Prefix: string;
    linkedPartNumber: string | null;
    linkedPartNumberNormalized: string | null;
    fileCount: number;
    totalSizeBytes: number;
    assets: ImageDriveAsset[];
    createdAt: Date;
    updatedAt: Date;
}
