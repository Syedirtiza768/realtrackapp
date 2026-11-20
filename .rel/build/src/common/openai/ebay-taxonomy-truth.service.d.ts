import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { EbayCategory } from '../../listings/entities/ebay-category.entity.js';
export interface TaxonomyTruthResult {
    hardFails: string[];
    softFails: string[];
    skipped: boolean;
}
export declare class EbayTaxonomyTruthService {
    private readonly config;
    private readonly categoryRepo;
    private readonly logger;
    constructor(config: ConfigService, categoryRepo: Repository<EbayCategory>);
    isEnabled(): boolean;
    validate(ebayCategoryId: string | undefined | null, itemSpecifics: Record<string, string>): Promise<TaxonomyTruthResult>;
}
