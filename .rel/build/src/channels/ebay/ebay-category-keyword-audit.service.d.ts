import { Repository } from 'typeorm';
import { EbayTaxonomyApiService } from './ebay-taxonomy-api.service.js';
import { EbayCategoryMapping } from '../../motors-intelligence/entities/ebay-category-mapping.entity.js';
export interface CategoryKeywordAuditFinding {
    categoryId: string;
    categoryName: string;
    keywords: string[];
    reason: string;
}
export declare class EbayCategoryKeywordAuditService {
    private readonly taxonomy;
    private readonly categoryMappingRepo;
    private readonly logger;
    private static readonly MOTORS_TREE_ID;
    constructor(taxonomy: EbayTaxonomyApiService, categoryMappingRepo: Repository<EbayCategoryMapping>);
    auditCategoryKeywords(): Promise<CategoryKeywordAuditFinding[]>;
    private markInactive;
}
