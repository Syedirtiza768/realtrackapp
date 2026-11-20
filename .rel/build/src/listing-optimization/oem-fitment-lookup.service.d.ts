import { OpenAiService } from '../common/openai/openai.service.js';
export interface OemFitmentLookupInput {
    partBrand: string;
    mpn: string;
    vehicleMake: string;
    vehicleModel: string;
    marketplace: string;
    partName?: string;
}
export interface OemFitmentLookupResult {
    make: string;
    model: string;
    trim?: string;
    startYear: number;
    endYear: number;
    supportedYears?: number[];
    sourceUrl: string;
    sourceTitle: string;
    evidence: string;
}
export declare class OemFitmentLookupService {
    private readonly openAi;
    private readonly logger;
    private activeLookups;
    private readonly maxConcurrentLookups;
    private readonly lookupWaiters;
    private readonly inFlightLookups;
    private readonly lookupCache;
    constructor(openAi: OpenAiService);
    lookup(input: OemFitmentLookupInput): Promise<OemFitmentLookupResult | null>;
    private lookupExactPart;
    private rangeFromCitedCatalogPages;
    private hasExactMpnToken;
    private yearSpecificCatalogYear;
    private hasExactPartNameContext;
    private modelYearsInInterval;
    private isProwler;
    private hasExactIdentifierToken;
    private extractTargetYearRanges;
    private exactPartDateBounds;
    private prCodeKey;
    private partNumberTokens;
    private makeInSource;
    private matchesMake;
    private sourceMentionsMake;
    private makeAliasesForVehicle;
    private makeAliases;
    private matchesModel;
    private sourceMentionsModel;
    private isVolkswagenGolfGtiAlias;
    private modelTokens;
    private partNameTokens;
    private normalizeIdentifier;
    private normalizeUrl;
    private stringValue;
    private catalogSearchTerms;
    private withLookupSlot;
}
