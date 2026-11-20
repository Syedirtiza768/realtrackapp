export declare class UpdateAssetDto {
    sortOrder?: number;
    isPrimary?: boolean;
}
export declare class ImageTransformDto {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'inside' | 'outside' | 'fill';
    quality?: number;
}
