import { EbayMvlService } from '../fitment/ebay-mvl.service.js';
import { MvlFitmentExpanderService } from '../fitment/mvl-fitment-expander.service.js';
import { VinDecodeService } from '../fitment/vin-decode.service.js';
import { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import { OemFitmentLookupService } from './oem-fitment-lookup.service.js';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import type { FitmentRow, FitmentStatus } from './listing-optimization.types.js';
export interface FitmentDiscoveryResult {
    status: FitmentStatus;
    confidence: number;
    rows: FitmentRow[];
    donorVinDecoded: Record<string, unknown> | null;
    donorVin: string | null;
    categorySupportsCompatibility: boolean;
    manualReviewReasons: string[];
    ebayCatalogCategoryId?: string | null;
    ebayCatalogCategoryName?: string | null;
}
export declare class FitmentDiscoveryService {
    private readonly vinDecode;
    private readonly mvl;
    private readonly mvlExpander;
    private readonly browseApi;
    private readonly oemFitmentLookup?;
    private readonly logger;
    constructor(vinDecode: VinDecodeService, mvl: EbayMvlService, mvlExpander: MvlFitmentExpanderService, browseApi: EbayBrowseApiService, oemFitmentLookup?: OemFitmentLookupService | undefined);
    discover(product: CatalogProduct, options?: {
        marketplace?: string | null;
        categoryId?: string;
    }): Promise<FitmentDiscoveryResult>;
    private candidatesFromTitle;
    private candidatesFromTitleText;
    private extractDonorVin;
    private hasCompleteYearRange;
    private hasPartSpecificYearRange;
    private vehicleModelMatches;
    private vehicleMakeMatches;
    private vehicleFromCombinedBrand;
    private hasExactOemRangeNote;
    private modelTokens;
    private rowsFromOemCatalogLookup;
    private normalizeOemCatalogModelToMvl;
    private modelWords;
    private rowsFromExactMpnLookup;
    private expandHintYears;
    private normalizeIdentifier;
    private findAspectValue;
    private browseMarketplaceId;
    private rowFromRaw;
    private rawString;
    private formatEngine;
    private validateAgainstEbay;
    private deduplicateFitments;
    toFitmentDataJson(rows: FitmentRow[]): Record<string, unknown>[];
}
