import { VerticalsService } from '../verticals/verticals.service.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogImportService } from './catalog-import.service.js';
import type { ProductVertical } from '../verticals/vertical.types.js';
import { BackfillListingsDto, ClearCatalogDto, ImportQueryDto, ImportRowQueryDto, StartImportDto } from './dto/catalog-import.dto.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
export declare class ScopedImportQueryDto extends ImportQueryDto {
    vertical?: ProductVertical;
}
export declare class CatalogImportController {
    private readonly importService;
    private readonly rbac;
    private readonly userOrganizations;
    private readonly verticals;
    constructor(importService: CatalogImportService, rbac: RbacService, userOrganizations: UserOrganizationService, verticals: VerticalsService);
    private scope;
    private accessibleImport;
    private validateFashionMapping;
    uploadCsv(file: Express.Multer.File, user: User, columnMappingStr?: string, verticalRaw?: string): Promise<{
        import: import("./entities/catalog-import.entity.js").CatalogImport;
        detectedHeaders: string[];
        columnMapping: Record<string, string> | null;
        catalogFields: {
            field: string;
            label: string;
            required: boolean;
        }[];
    }>;
    startImport(dto: StartImportDto, user: User): Promise<{
        import: import("./entities/catalog-import.entity.js").CatalogImport;
    }>;
    backfillListings(dto: BackfillListingsDto): Promise<{
        result: import("./catalog-import.service.js").BackfillListingsResult;
    }>;
    clearAllCatalog(dto: ClearCatalogDto): Promise<{
        result: {
            motorsProductsUnlinked: number;
            listingRecordsDeleted: number;
            catalogProductsDeleted: number;
            catalogImportsDeleted: number;
            catalogImportRowsDeleted: number;
            complianceAuditLogsDeleted: number;
        };
    }>;
    listImports(user: User, query: ScopedImportQueryDto): Promise<{
        imports: import("./entities/catalog-import.entity.js").CatalogImport[];
        total: number;
    }>;
    getStats(user: User, query: ScopedImportQueryDto): Promise<{
        totalImports: number;
        totalProductsInserted: number;
        totalDuplicatesSkipped: number;
        totalInvalidRows: number;
        totalCatalogProducts: number;
        recentImports: import("./entities/catalog-import.entity.js").CatalogImport[];
    }>;
    getCatalogFields(): {
        fields: {
            field: string;
            label: string;
            required: boolean;
        }[];
    };
    getImport(id: string, user: User): Promise<{
        import: import("./entities/catalog-import.entity.js").CatalogImport;
        verification: import("./catalog-import.service.js").ImportVerificationSummary | null;
    }>;
    previewImport(id: string, user: User): Promise<{
        rows: Record<string, string>[];
        fields: {
            field: string;
            label: string;
            required: boolean;
        }[];
    }>;
    getImportRows(id: string, query: ImportRowQueryDto, user: User): Promise<{
        rows: import("./entities/catalog-import-row.entity.js").CatalogImportRow[];
        total: number;
    }>;
    cancelImport(id: string, user: User): Promise<{
        import: import("./entities/catalog-import.entity.js").CatalogImport;
    }>;
    retryImport(id: string, user: User): Promise<{
        import: import("./entities/catalog-import.entity.js").CatalogImport;
    }>;
}
