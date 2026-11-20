import { ExportRuleService } from './export-rule.service.js';
import { CreateExportRuleDto, UpdateExportRuleDto } from './dto/export-rule.dto.js';
import type { ExportRule } from './entities/export-rule.entity.js';
export declare class ExportRuleController {
    private readonly service;
    constructor(service: ExportRuleService);
    create(dto: CreateExportRuleDto): Promise<ExportRule>;
    findAll(): Promise<ExportRule[]>;
    findOne(id: string): Promise<ExportRule>;
    update(id: string, dto: UpdateExportRuleDto): Promise<ExportRule>;
    remove(id: string): Promise<void>;
    execute(id: string): Promise<{
        offersCreated: number;
    }>;
    preview(id: string): Promise<{
        matchingProductCount: number;
        products: {
            id: string;
            sku: string;
            title: string;
            brand: string | null;
            retailPrice: number | null;
            condition: string;
        }[];
    }>;
}
