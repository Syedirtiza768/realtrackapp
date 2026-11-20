import { ListingRecord } from '../../listings/listing-record.entity.js';
export declare class ImageAsset {
    id: string;
    listingId: string | null;
    listing?: ListingRecord;
    jobId: string | null;
    s3Bucket: string;
    s3Key: string;
    s3KeyThumb: string | null;
    s3KeyMedium: string | null;
    cdnUrl: string | null;
    originalFilename: string | null;
    mimeType: string;
    fileSizeBytes: number;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    sortOrder: number;
    isPrimary: boolean;
    uploadedAt: Date;
    deletedAt: Date | null;
}
