import { Repository } from 'typeorm';
import { ExportRule } from './entities/export-rule.entity.js';
import { MasterProduct } from './entities/master-product.entity.js';
import { EbayOffer } from './entities/ebay-offer.entity.js';
import type { CreateExportRuleDto, UpdateExportRuleDto } from './dto/export-rule.dto.js';
export declare class ExportRuleService {
    private readonly ruleRepo;
    private readonly productRepo;
    private readonly offerRepo;
    private readonly logger;
    constructor(ruleRepo: Repository<ExportRule>, productRepo: Repository<MasterProduct>, offerRepo: Repository<EbayOffer>);
    create(dto: CreateExportRuleDto): Promise<ExportRule>;
    findAll(organizationId?: string): Promise<ExportRule[]>;
    findOne(id: string): Promise<ExportRule>;
    update(id: string, dto: UpdateExportRuleDto): Promise<ExportRule>;
    remove(id: string): Promise<void>;
    findMatchingProducts(ruleId: string): Promise<MasterProduct[]>;
    computeRulePrice(rule: ExportRule, basePrice: number): number;
    computeRuleTitle(rule: ExportRule, baseTitle: string): string;
    executeRule(ruleId: string): Promise<number>;
}
