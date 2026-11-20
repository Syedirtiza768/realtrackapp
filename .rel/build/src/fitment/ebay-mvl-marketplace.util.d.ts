export type MvlMarketplace = 'US' | 'AU' | 'DE' | 'GB';
export declare function resolveMvlMarketplaceFromTreeId(treeId?: string | null): MvlMarketplace;
export declare function resolveMvlMarketplace(marketplace?: string | null): MvlMarketplace;
export declare function mvlMarketplaceToTreeId(marketplace: MvlMarketplace): string;
