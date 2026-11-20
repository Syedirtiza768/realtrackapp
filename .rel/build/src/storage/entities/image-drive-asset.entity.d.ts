import { ImageDriveFolder } from './image-drive-folder.entity.js';
export declare class ImageDriveAsset {
    id: string;
    folderId: string;
    folder: ImageDriveFolder;
    filename: string;
    s3Key: string;
    cdnUrl: string;
    s3KeyThumb: string | null;
    s3KeyMedium: string | null;
    mimeType: string | null;
    fileSizeBytes: number;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    createdAt: Date;
    deletedAt: Date | null;
}
