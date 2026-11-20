import type { Response } from 'express';
import { User } from '../auth/entities/user.entity.js';
import { BusinessIndustrialService } from '../verticals/business-industrial.service.js';
import { CatalogWorkspaceService } from './catalog-workspace.service.js';
import { CatalogBulkIdsDto, CatalogBulkPoliciesDto, CatalogBulkTeamDto, CatalogExportDto, CatalogProductPatchDto, CatalogQueryDto, CatalogSuggestQueryDto } from './catalog-workspace.dto.js';
export declare class FashionCatalogWorkspaceController {
    private readonly catalog;
    constructor(catalog: CatalogWorkspaceService);
    search(user: User, dto: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogSearchResponse>;
    suggest(user: User, dto: CatalogSuggestQueryDto): Promise<{
        vertical: "fashion" | "business_industrial" | "automotive";
        suggestions: {
            type: "sku" | "title" | "brand" | "category" | "mpn";
            value: string;
            label: string;
            count: number;
            score: number;
        }[];
        queryTimeMs: number;
    }>;
    facets(user: User, dto: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogFacetsResponse>;
    summary(user: User, dto: CatalogQueryDto): Promise<{
        vertical: "fashion" | "business_industrial" | "automotive";
        organizationId: string;
        total: number;
        withImages: number;
        missingImages: number;
        published: number;
    }>;
    detail(user: User, id: string, dto: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogItem>;
    patch(user: User, id: string, dto: CatalogProductPatchDto, query: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogItem>;
    team(user: User, dto: CatalogBulkTeamDto): Promise<{
        results: Record<string, unknown>[];
        succeeded: number;
        failed: number;
    }>;
    policies(user: User, dto: CatalogBulkPoliciesDto): Promise<{
        results: Record<string, unknown>[];
        succeeded: number;
        failed: number;
    }>;
    delete(user: User, dto: CatalogBulkIdsDto): Promise<{
        results: Record<string, unknown>[];
        succeeded: number;
        failed: number;
    }>;
    export(user: User, dto: CatalogExportDto, response: Response): Promise<void>;
}
export declare class BusinessIndustrialCatalogWorkspaceController {
    private readonly catalog;
    private readonly businessIndustrial;
    constructor(catalog: CatalogWorkspaceService, businessIndustrial: BusinessIndustrialService);
    search(user: User, dto: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogSearchResponse>;
    suggest(user: User, dto: CatalogSuggestQueryDto): Promise<{
        vertical: "fashion" | "business_industrial" | "automotive";
        suggestions: {
            type: "sku" | "title" | "brand" | "category" | "mpn";
            value: string;
            label: string;
            count: number;
            score: number;
        }[];
        queryTimeMs: number;
    }>;
    facets(user: User, dto: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogFacetsResponse>;
    summary(user: User, dto: CatalogQueryDto): Promise<{
        vertical: "fashion" | "business_industrial" | "automotive";
        organizationId: string;
        total: number;
        withImages: number;
        missingImages: number;
        published: number;
    }>;
    detail(user: User, id: string, dto: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogItem>;
    patch(user: User, id: string, dto: CatalogProductPatchDto, query: CatalogQueryDto): Promise<import("./catalog-workspace.service.js").CatalogItem>;
    team(user: User, dto: CatalogBulkTeamDto): Promise<{
        results: Record<string, unknown>[];
        succeeded: number;
        failed: number;
    }>;
    policies(user: User, dto: CatalogBulkPoliciesDto): Promise<{
        results: Record<string, unknown>[];
        succeeded: number;
        failed: number;
    }>;
    delete(user: User, dto: CatalogBulkIdsDto): Promise<{
        results: Record<string, unknown>[];
        succeeded: number;
        failed: number;
    }>;
    export(user: User, dto: CatalogExportDto, response: Response): Promise<void>;
    categories(): readonly [{
        readonly id: "industrial_automation";
        readonly label: "Industrial automation & controls";
        readonly restricted: false;
    }, {
        readonly id: "electrical_equipment";
        readonly label: "Electrical equipment & protection";
        readonly restricted: false;
    }, {
        readonly id: "machinery_tooling";
        readonly label: "Manufacturing machinery, tooling & spare parts";
        readonly restricted: false;
    }, {
        readonly id: "hydraulics_pneumatics";
        readonly label: "Hydraulics, pneumatics, pumps & valves";
        readonly restricted: false;
    }, {
        readonly id: "test_measurement";
        readonly label: "Test, measurement & inspection equipment";
        readonly restricted: false;
    }, {
        readonly id: "material_handling";
        readonly label: "Material handling & industrial storage";
        readonly restricted: false;
    }, {
        readonly id: "commercial_equipment";
        readonly label: "Commercial kitchen, office & retail equipment";
        readonly restricted: false;
    }, {
        readonly id: "construction_safety";
        readonly label: "Construction, industrial supplies & safety";
        readonly restricted: false;
    }, {
        readonly id: "medical_laboratory";
        readonly label: "Medical and laboratory equipment";
        readonly restricted: true;
    }, {
        readonly id: "hazmat_chemical";
        readonly label: "Hazardous materials and chemicals";
        readonly restricted: true;
    }];
}
