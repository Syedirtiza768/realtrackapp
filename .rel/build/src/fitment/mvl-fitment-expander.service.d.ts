import { ConfigService } from '@nestjs/config';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';
import { expandFitmentDeterministic, type DonorVehicle, type ExpandedFitmentRow, type FitmentExpansionMode } from './mvl-fitment-expander.util.js';
export interface MvlFitmentExpandInput {
    donor: DonorVehicle;
    partType?: string;
    placement?: string;
    mpn?: string;
    profile?: 'compact' | 'full';
    marketplace?: string | null;
    treeId?: string;
    interchangeHints?: Array<Record<string, unknown>>;
}
export interface MvlFitmentExpandResult {
    status: 'completed' | 'needs_review';
    fitmentSource: 'mvl' | 'mvl+filtered' | 'mvl+ai' | 'ai' | 'mvl_pending_db';
    ranges: ReturnType<typeof expandFitmentDeterministic>['ranges'];
    expandedRows: ExpandedFitmentRow[];
    coverage: ReturnType<typeof expandFitmentDeterministic>['coverage'];
    needsAiInterchange: boolean;
    manualReviewReasons: string[];
}
export declare class MvlFitmentExpanderService {
    private readonly config;
    private readonly mvlStore;
    private readonly logger;
    private platformRanges;
    constructor(config: ConfigService, mvlStore: EbayMvlStoreService);
    getExpansionMode(): FitmentExpansionMode;
    private loadPlatformRanges;
    private resolveMarketplace;
    expand(input: MvlFitmentExpandInput): Promise<MvlFitmentExpandResult>;
}
