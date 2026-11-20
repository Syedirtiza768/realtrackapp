export declare function inferMarketplaceFromAccountName(accountName: string): string | null;
export declare class SellerpunditMarketplaceRegistry {
    siteIdFor(marketplaceId: string): string;
    defaultMarketplacesForImport(): string[];
    inferMarketplaceFromAccountName(accountName: string): string | null;
    resolveMarketplaceForAccount(accountName: string, fallbackMarketplaceId: string): string;
    countryForSite(siteId: string): string;
    currencyForMarketplace(marketplaceId: string): string;
}
