export type EbayMvlReleaseStatus = 'importing' | 'active' | 'superseded' | 'failed';
export declare class EbayMvlRelease {
    id: string;
    marketplace: string;
    versionLabel: string;
    fileName: string;
    fileSha256: string;
    sourceRowCount: number;
    entryCount: number;
    status: EbayMvlReleaseStatus;
    errorMessage: string | null;
    importedAt: Date | null;
    createdAt: Date;
}
