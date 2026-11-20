"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogImportController = exports.ScopedImportQueryDto = void 0;
const verticals_service_js_1 = require("../verticals/verticals.service.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const catalog_import_service_js_1 = require("./catalog-import.service.js");
const class_validator_1 = require("class-validator");
const catalog_import_dto_js_1 = require("./dto/catalog-import.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
class ScopedImportQueryDto extends catalog_import_dto_js_1.ImportQueryDto {
    vertical;
}
exports.ScopedImportQueryDto = ScopedImportQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['automotive', 'fashion', 'business_industrial']),
    __metadata("design:type", String)
], ScopedImportQueryDto.prototype, "vertical", void 0);
let CatalogImportController = class CatalogImportController {
    importService;
    rbac;
    userOrganizations;
    verticals;
    constructor(importService, rbac, userOrganizations, verticals) {
        this.importService = importService;
        this.rbac = rbac;
        this.userOrganizations = userOrganizations;
        this.verticals = verticals;
    }
    async scope(user, vertical) {
        const [organization, viewAll, catalog, fashion, businessIndustrial] = await Promise.all([
            this.userOrganizations.resolveOrganizationId(user.id),
            this.rbac.userHasPermission(user.id, 'users.view'),
            this.rbac.userHasPermission(user.id, 'catalog.view'),
            this.rbac.userHasPermission(user.id, 'fashion.import'),
            this.rbac.userHasPermission(user.id, 'business_industrial.access'),
        ]);
        const allowed = catalog ? ['automotive'] : [];
        if (fashion)
            allowed.push('fashion');
        if (businessIndustrial)
            allowed.push('business_industrial');
        if (vertical && !allowed.includes(vertical))
            throw new common_1.ForbiddenException('Import permission is required for this vertical');
        return {
            organizationId: organization.organizationId,
            viewerId: user.id,
            viewAll,
            verticals: vertical ? [vertical] : allowed,
        };
    }
    async accessibleImport(id, user, write = false) {
        const scope = await this.scope(user);
        if (write) {
            if (await this.rbac.userHasPermission(user.id, 'catalog.import'))
                scope.verticals.push('automotive');
            if (await this.rbac.userHasPermission(user.id, 'business_industrial.import'))
                scope.verticals.push('business_industrial');
        }
        const result = await this.importService.getImport(id, user.id, scope.viewAll, scope);
        if (write) {
            const vertical = result.import.vertical ?? 'automotive';
            const permission = vertical === 'fashion'
                ? 'fashion.import'
                : vertical === 'business_industrial'
                    ? 'business_industrial.import'
                    : 'catalog.import';
            if (!(await this.rbac.userHasPermission(user.id, permission)))
                throw new common_1.ForbiddenException('Import permission is required for this vertical');
            await this.verticals.assertIntakeVerticalEnabled(vertical);
        }
        return { ...result, viewAll: scope.viewAll };
    }
    validateFashionMapping(mapping, headers) {
        const fields = new Set(this.importService.getCatalogFields().map((field) => field.field));
        const values = Object.values(mapping);
        if (!mapping ||
            Array.isArray(mapping) ||
            Object.entries(mapping).some(([header, field]) => !headers.includes(header) ||
                typeof field !== 'string' ||
                !fields.has(field))) {
            throw new common_1.BadRequestException('Column mapping must use detected headers and supported catalog fields');
        }
        if (!values.includes('title'))
            throw new common_1.BadRequestException('Map a column to Product Title before starting');
        if (new Set(values).size !== values.length)
            throw new common_1.BadRequestException('Map each catalog field only once');
    }
    async uploadCsv(file, user, columnMappingStr, verticalRaw) {
        if (!file) {
            throw new common_1.BadRequestException('CSV or Excel file is required');
        }
        let columnMapping;
        if (columnMappingStr) {
            try {
                columnMapping = JSON.parse(columnMappingStr);
            }
            catch {
            }
        }
        const organization = await this.userOrganizations.resolveOrganizationId(user.id);
        const vertical = this.verticals.normalizeIntakeVertical(verticalRaw ?? 'automotive');
        const hasFashionImport = await this.rbac.userHasPermission(user.id, 'fashion.import');
        const hasBusinessIndustrialImport = await this.rbac.userHasPermission(user.id, 'business_industrial.import');
        const hasCatalogImport = await this.rbac.userHasPermission(user.id, 'catalog.import');
        const allowed = vertical === 'fashion'
            ? hasFashionImport
            : vertical === 'business_industrial'
                ? hasBusinessIndustrialImport
                : hasCatalogImport;
        if (!allowed) {
            throw new common_1.BadRequestException(vertical === 'fashion'
                ? 'Fashion import permission is required for Fashion imports'
                : vertical === 'business_industrial'
                    ? 'Business & Industrial import permission is required for Business & Industrial imports'
                    : 'Catalog import permission is required for automotive imports');
        }
        await this.verticals.assertIntakeVerticalEnabled(vertical);
        const importRecord = await this.importService.handleUpload(file, columnMapping, user.id, vertical, organization.organizationId);
        return {
            import: importRecord,
            detectedHeaders: importRecord.detectedHeaders,
            columnMapping: importRecord.columnMapping,
            catalogFields: this.importService.getCatalogFields(),
        };
    }
    async startImport(dto, user) {
        const importContext = await this.accessibleImport(dto.importId, user, true);
        const viewAll = importContext.viewAll;
        if (importContext.import.vertical === 'fashion') {
            if (!importContext.import.totalRows)
                throw new common_1.BadRequestException('The source file has no data rows');
            this.validateFashionMapping(dto.columnMapping ?? importContext.import.columnMapping ?? {}, importContext.import.detectedHeaders);
        }
        const isFashion = importContext.import.vertical === 'fashion';
        const isBusinessIndustrial = importContext.import.vertical === 'business_industrial';
        const allowed = await this.rbac.userHasPermission(user.id, isFashion
            ? 'fashion.import'
            : isBusinessIndustrial
                ? 'business_industrial.import'
                : 'catalog.import');
        if (!allowed) {
            throw new common_1.BadRequestException(isFashion
                ? 'Fashion import permission is required for this import'
                : isBusinessIndustrial
                    ? 'Business & Industrial import permission is required for this import'
                    : 'Catalog import permission is required for this import');
        }
        const importRecord = await this.importService.startImport(dto.importId, dto.columnMapping, user.id, viewAll);
        return { import: importRecord };
    }
    async backfillListings(dto) {
        const result = await this.importService.backfillListings(dto.importId);
        return { result };
    }
    async clearAllCatalog(dto) {
        const result = await this.importService.clearAllCatalog(dto.confirm);
        return { result };
    }
    async listImports(user, query) {
        const scope = await this.scope(user, query.vertical);
        return this.importService.listImports(query.status, query.limit ?? 20, query.offset ?? 0, user.id, scope.viewAll, scope);
    }
    async getStats(user, query) {
        return this.importService.getImportStats(await this.scope(user, query.vertical));
    }
    getCatalogFields() {
        return { fields: this.importService.getCatalogFields() };
    }
    async getImport(id, user) {
        const { import: record, verification } = await this.accessibleImport(id, user);
        return { import: record, verification };
    }
    async previewImport(id, user) {
        const { import: record } = await this.accessibleImport(id, user);
        return {
            rows: await this.importService.previewImport(record),
            fields: this.importService.getCatalogFields(),
        };
    }
    async getImportRows(id, query, user) {
        await this.accessibleImport(id, user);
        return this.importService.getImportRows(id, query.status, query.limit ?? 50, query.offset ?? 0);
    }
    async cancelImport(id, user) {
        const { viewAll } = await this.accessibleImport(id, user, true);
        const importRecord = await this.importService.cancelImport(id, user.id, viewAll);
        return { import: importRecord };
    }
    async retryImport(id, user) {
        const { viewAll } = await this.accessibleImport(id, user, true);
        const importRecord = await this.importService.retryImport(id, user.id, viewAll);
        return { import: importRecord };
    }
};
exports.CatalogImportController = CatalogImportController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, throttler_1.Throttle)({ medium: { limit: 3, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequireAnyPermission)('catalog.import', 'fashion.import', 'business_industrial.import'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                const uploadDir = process.env.CATALOG_UPLOAD_DIR ??
                    path.resolve(process.cwd(), 'uploads', 'catalog');
                fs.mkdirSync(uploadDir, { recursive: true });
                cb(null, uploadDir);
            },
            filename: (_req, file, cb) => {
                const safeFileName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                cb(null, safeFileName);
            },
        }),
        limits: { fileSize: 200 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const name = file.originalname.toLowerCase();
            if (file.mimetype === 'text/csv' ||
                name.endsWith('.csv') ||
                file.mimetype ===
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                name.endsWith('.xlsx') ||
                file.mimetype === 'application/vnd.ms-excel' ||
                name.endsWith('.xls')) {
                cb(null, true);
            }
            else {
                cb(new Error('Only CSV and Excel (.xlsx, .xls) files are accepted'), false);
            }
        },
    })),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a CSV or Excel catalog file for import' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)('columnMapping')),
    __param(3, (0, common_1.Body)('vertical')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "uploadCsv", null);
__decorate([
    (0, common_1.Post)('start'),
    (0, throttler_1.Throttle)({ medium: { limit: 5, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequireAnyPermission)('catalog.import', 'fashion.import', 'business_industrial.import'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Start processing an uploaded CSV import' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [catalog_import_dto_js_1.StartImportDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "startImport", null);
__decorate([
    (0, common_1.Post)('backfill-listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.import'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Backfill listing_records from existing catalog imports',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [catalog_import_dto_js_1.BackfillListingsDto]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "backfillListings", null);
__decorate([
    (0, common_1.Post)('clear-all'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.clear'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete all catalog_products, CSV import jobs/rows, compliance audit logs, and every listing_record (browse /catalog)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [catalog_import_dto_js_1.ClearCatalogDto]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "clearAllCatalog", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List catalog imports' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        ScopedImportQueryDto]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "listImports", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get catalog import aggregate stats' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        ScopedImportQueryDto]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('fields'),
    (0, swagger_1.ApiOperation)({ summary: 'Get available catalog fields for column mapping' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogImportController.prototype, "getCatalogFields", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific catalog import' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "getImport", null);
__decorate([
    (0, common_1.Get)(':id/preview'),
    (0, require_permissions_decorator_js_1.RequireAnyPermission)('catalog.view', 'fashion.import', 'business_industrial.import'),
    (0, swagger_1.ApiOperation)({
        summary: 'Preview the first five source rows of an accessible import',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "previewImport", null);
__decorate([
    (0, common_1.Get)(':id/rows'),
    (0, swagger_1.ApiOperation)({ summary: 'Get rows for a specific import' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, catalog_import_dto_js_1.ImportRowQueryDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "getImportRows", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, require_permissions_decorator_js_1.RequireAnyPermission)('catalog.import', 'fashion.import', 'business_industrial.import'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a pending or processing import' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "cancelImport", null);
__decorate([
    (0, common_1.Post)(':id/retry'),
    (0, require_permissions_decorator_js_1.RequireAnyPermission)('catalog.import', 'fashion.import', 'business_industrial.import'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Retry a failed import (resumes from last row)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogImportController.prototype, "retryImport", null);
exports.CatalogImportController = CatalogImportController = __decorate([
    (0, swagger_1.ApiTags)('Catalog Import'),
    (0, common_1.Controller)('catalog-import'),
    (0, require_permissions_decorator_js_1.RequireAnyPermission)('catalog.view', 'fashion.import', 'business_industrial.access'),
    __metadata("design:paramtypes", [catalog_import_service_js_1.CatalogImportService,
        rbac_service_js_1.RbacService,
        user_organization_service_js_1.UserOrganizationService,
        verticals_service_js_1.VerticalsService])
], CatalogImportController);
//# sourceMappingURL=catalog-import.controller.js.map