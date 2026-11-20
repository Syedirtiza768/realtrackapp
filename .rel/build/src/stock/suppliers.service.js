"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const index_js_1 = require("./entities/index.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
let SuppliersService = class SuppliersService {
    db;
    ledger;
    constructor(db, ledger) {
        this.db = db;
        this.ledger = ledger;
    }
    async list(scope, includeInactive = false) {
        return this.db.query(`SELECT s.id, s.code, s.name, s.type, s.contact_name AS "contactName", s.email, s.phone,
              s.website, s.currency, s.default_lead_time_days AS "defaultLeadTimeDays",
              s.supports_dropship AS "supportsDropship", s.notes, s.active,
              (SELECT count(*)::int FROM inventory_item_sources x WHERE x.supplier_id = s.id AND x.active) AS "skuCount",
              (SELECT count(*)::int FROM procurement_requests r WHERE r.supplier_id = s.id AND r.status IN ('open','ordered')) AS "openRequests",
              (SELECT count(*)::int FROM stock_documents d WHERE d.supplier_id = s.id AND d.doc_type = 'purchase_order'
                  AND d.status IN ('draft','ordered','partially_received')) AS "openPurchaseOrders"
         FROM suppliers s
        WHERE s.organization_id = $1 ${includeInactive ? '' : 'AND s.active'}
        ORDER BY s.name`, [scope.organizationId]);
    }
    async get(scope, id) {
        const s = await this.db
            .getRepository(index_js_1.Supplier)
            .findOneBy({ id, organizationId: scope.organizationId });
        if (!s)
            throw new common_1.NotFoundException('Supplier not found');
        return s;
    }
    async create(scope, dto) {
        const repo = this.db.getRepository(index_js_1.Supplier);
        const code = dto.code.trim().toUpperCase();
        if (await repo.existsBy({ organizationId: scope.organizationId, code }))
            throw new common_1.ConflictException(`Supplier ${code} already exists`);
        return repo.save(repo.create({
            organizationId: scope.organizationId,
            code,
            name: dto.name.trim(),
            type: dto.type ?? 'distributor',
            contactName: dto.contactName ?? null,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            website: dto.website ?? null,
            currency: (dto.currency ?? 'USD').toUpperCase(),
            defaultLeadTimeDays: dto.defaultLeadTimeDays ?? 3,
            supportsDropship: dto.supportsDropship ?? false,
            notes: dto.notes ?? null,
            active: dto.active ?? true,
        }));
    }
    async update(scope, id, dto) {
        const s = await this.get(scope, id);
        Object.assign(s, dto, dto.currency ? { currency: dto.currency.toUpperCase() } : {});
        const saved = await this.db.getRepository(index_js_1.Supplier).save(s);
        if (dto.active !== undefined) {
            const items = (await this.db.query(`SELECT inventory_item_id AS id FROM inventory_item_sources WHERE supplier_id = $1`, [id]));
            await this.ledger.markChannelDirty(this.db.manager, scope.organizationId, items.map((i) => i.id));
            this.ledger.emitChanged(scope.organizationId, items.map((i) => ({ itemId: i.id })));
        }
        return saved;
    }
    async listForItem(scope, itemId) {
        return this.db.query(`SELECT x.id, x.supplier_id AS "supplierId", s.code AS "supplierCode", s.name AS "supplierName",
              x.supplier_sku AS "supplierSku", x.unit_cost AS "unitCost", x.currency,
              x.available_qty AS "availableQty",
              COALESCE(x.lead_time_days, s.default_lead_time_days) AS "leadTimeDays",
              x.priority, x.fulfillment_mode AS "fulfillmentMode", x.url, x.active,
              x.last_checked_at AS "lastCheckedAt", s.active AS "supplierActive"
         FROM inventory_item_sources x
         JOIN suppliers s ON s.id = x.supplier_id
        WHERE x.organization_id = $1 AND x.inventory_item_id = $2
        ORDER BY x.active DESC, x.priority, x.unit_cost NULLS LAST`, [scope.organizationId, itemId]);
    }
    async upsertSource(scope, itemId, dto) {
        const item = await this.db
            .getRepository(index_js_1.InventoryItem)
            .findOneBy({ id: itemId, organizationId: scope.organizationId });
        if (!item)
            throw new common_1.NotFoundException('Inventory item not found');
        const supplier = await this.get(scope, dto.supplierId);
        if (dto.fulfillmentMode === 'dropship' && !supplier.supportsDropship)
            throw new common_1.ConflictException(`${supplier.name} is not marked as supporting dropship`);
        const repo = this.db.getRepository(index_js_1.InventoryItemSource);
        const existing = await repo.findOneBy({ inventoryItemId: itemId, supplierId: dto.supplierId });
        const source = existing ?? repo.create({ organizationId: scope.organizationId, inventoryItemId: itemId, supplierId: dto.supplierId });
        Object.assign(source, {
            ...(dto.supplierSku !== undefined ? { supplierSku: dto.supplierSku.trim() || null } : {}),
            ...(dto.unitCost !== undefined ? { unitCost: String(dto.unitCost) } : {}),
            ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
            ...(dto.availableQty !== undefined ? { availableQty: dto.availableQty, lastCheckedAt: new Date() } : {}),
            ...(dto.leadTimeDays !== undefined ? { leadTimeDays: dto.leadTimeDays } : {}),
            ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
            ...(dto.fulfillmentMode !== undefined ? { fulfillmentMode: dto.fulfillmentMode } : {}),
            ...(dto.url !== undefined ? { url: dto.url || null } : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
        });
        if (!existing && dto.currency === undefined)
            source.currency = supplier.currency;
        const saved = await repo.save(source);
        await this.ledger.markChannelDirty(this.db.manager, scope.organizationId, [itemId]);
        this.ledger.emitChanged(scope.organizationId, [{ itemId }]);
        return saved;
    }
    async removeSource(scope, itemId, sourceId) {
        const res = await this.db.getRepository(index_js_1.InventoryItemSource).delete({
            id: sourceId,
            inventoryItemId: itemId,
            organizationId: scope.organizationId,
        });
        if (!res.affected)
            throw new common_1.NotFoundException('Source not found');
        await this.ledger.markChannelDirty(this.db.manager, scope.organizationId, [itemId]);
        this.ledger.emitChanged(scope.organizationId, [{ itemId }]);
        return { deleted: true };
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        stock_ledger_service_js_1.StockLedgerService])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map