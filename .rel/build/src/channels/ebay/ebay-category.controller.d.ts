import { EbayTaxonomyApiService } from './ebay-taxonomy-api.service.js';
export declare class EbayCategoryController {
    private readonly taxonomy;
    constructor(taxonomy: EbayTaxonomyApiService);
    suggest(q: string): Promise<{
        suggestions: {
            id: string;
            name: string;
        }[];
    }>;
}
