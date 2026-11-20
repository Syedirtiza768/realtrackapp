import { Repository } from 'typeorm';
import { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { EbayCategory } from '../listings/entities/ebay-category.entity.js';
export interface PartIdentificationCandidate {
    brand?: string | null;
    mpn?: string | null;
    oemNumber?: string | null;
}
export interface BrowseCorroborationResult {
    checked: boolean;
    found: boolean;
    categoryId?: string | null;
    categoryName?: string | null;
    fitmentHints?: Array<{
        year?: string;
        make?: string;
        model?: string;
    }>;
    hallucinationWarnings: string[];
}
export declare class PartIdentificationService {
    private readonly browseApi;
    private readonly taxonomy;
    private readonly categoryRepo;
    private readonly logger;
    constructor(browseApi: EbayBrowseApiService, taxonomy: EbayTaxonomyApiService, categoryRepo: Repository<EbayCategory>);
    identifyAndCorroborate(candidate: PartIdentificationCandidate): Promise<BrowseCorroborationResult>;
    ensureCategoryCached(categoryId: string | null | undefined, treeId?: string): Promise<void>;
}
