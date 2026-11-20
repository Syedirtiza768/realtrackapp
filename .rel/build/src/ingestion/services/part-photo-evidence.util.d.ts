export interface PhotoPartIdentity {
    partName?: string;
    partNumber?: string;
    note?: string;
}
export declare function visibleTextContainsPartNumber(visibleText: string[], partNumber: string): boolean;
export declare function resolveVerifiedPhotoIdentity(identity: PhotoPartIdentity, visibleText: string[], expectedPartNumber: string): PhotoPartIdentity | null;
