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
var StockIntakeListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockIntakeListener = exports.STOCK_FASHION_WAREHOUSE_EVENT = exports.STOCK_BI_UNITS_EVENT = exports.STOCK_INTAKE_EVENT = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("typeorm");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const index_js_1 = require("./entities/index.js");
const inventory_items_service_js_1 = require("./inventory-items.service.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
const stock_operations_service_js_1 = require("./stock-operations.service.js");
exports.STOCK_INTAKE_EVENT = 'stock.intake.received';
exports.STOCK_BI_UNITS_EVENT = 'stock.bi-units.saved';
exports.STOCK_FASHION_WAREHOUSE_EVENT = 'stock.fashion-warehouse.saved';
let StockIntakeListener = StockIntakeListener_1 = class StockIntakeListener {
    db;
    userOrgs;
    items;
    ops;
    ledger;
    logger = new common_1.Logger(StockIntakeListener_1.name);
    constructor(db, userOrgs, items, ops, ledger) {
        this.db = db;
        this.userOrgs = userOrgs;
        this.items = items;
        this.ops = ops;
        this.ledger = ledger;
    }
    async enabledOrg(organizationId, userId) {
        let org = organizationId ?? null;
        if (!org && userId)
            org = (await this.userOrgs.resolveOrganizationId(userId)).organizationId;
        if (!org)
            return null;
        const def = await this.db.getRepository(index_js_1.Warehouse).findOneBy({ organizationId: org, isDefault: true });
        return def ? { org, def } : null;
    }
    async onIntake(p) {
        try {
            if (!p.sku?.trim() || !(p.quantity > 0))
                return;
            const ctx = await this.enabledOrg(p.organizationId, p.userId);
            if (!ctx)
                return;
            const warehouse = (p.warehouseCode
                ? await this.db.getRepository(index_js_1.Warehouse).findOneBy({ organizationId: ctx.org, code: p.warehouseCode.trim().toUpperCase(), active: true })
                : null) ?? ctx.def;
            const bin = p.binCode?.trim()
                ? await this.db.getRepository(index_js_1.WarehouseLocation).findOneBy({ warehouseId: warehouse.id, code: p.binCode.trim().toUpperCase(), active: true })
                : null;
            let catalogProductId = p.catalogProductId ?? null;
            if (!catalogProductId) {
                const [c] = (await this.db.query(`SELECT id FROM catalog_products WHERE sku = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`, [p.sku.trim(), ctx.org]));
                catalogProductId = c?.id ?? null;
            }
            const item = await this.items.findOrCreate(this.db.manager, ctx.org, {
                sku: p.sku,
                vertical: p.vertical,
                title: p.title,
                imageUrl: p.imageUrl,
                catalogProductId,
                listingRecordId: p.listingRecordId,
                trackingMode: p.trackingMode,
            });
            await this.ops.receive({ organizationId: ctx.org, userId: p.userId ?? null, warehouseIds: null }, {
                itemId: item.id,
                warehouseId: warehouse.id,
                locationId: bin?.id,
                quantity: p.quantity,
                unitCost: p.unitCost ?? undefined,
                lotCode: p.lotCode ?? undefined,
                conditionId: p.conditionId ?? undefined,
                reference: `${p.vertical} intake`,
                note: p.binCode && !bin ? `Intake shelf label "${p.binCode}" did not match a bin in ${warehouse.code}` : undefined,
                idempotencyKey: p.idempotencyKey,
            });
        }
        catch (err) {
            this.logger.warn(`Intake stock receipt failed for ${p.sku}: ${err.message}`);
        }
    }
    async onBiUnits(p) {
        try {
            const ctx = await this.enabledOrg(p.organizationId);
            if (!ctx)
                return;
            const [product] = (await this.db.query(`SELECT id, sku, title, image_urls[1] AS image FROM catalog_products WHERE id = $1 AND organization_id = $2`, [p.catalogProductId, ctx.org]));
            if (!product?.sku)
                return;
            const item = await this.items.findOrCreate(this.db.manager, ctx.org, {
                sku: product.sku,
                vertical: 'business_industrial',
                title: product.title,
                imageUrl: product.image,
                catalogProductId: product.id,
                trackingMode: 'serial',
            });
            await this.db.transaction('READ COMMITTED', async (em) => {
                const units = (await em.query(`INSERT INTO inventory_units (organization_id, inventory_item_id, warehouse_id, serial_private, serial_public, status, source_ref, received_at)
           SELECT $1, $2, $3, u.serial_number_private, u.serial_number_public, 'available', 'bi_unit:' || u.id, now()
             FROM business_industrial_units u
            WHERE u.organization_id = $1 AND u.catalog_product_id = $4 AND u.status IN ('available','allocated')
           ON CONFLICT (source_ref) WHERE source_ref IS NOT NULL DO NOTHING
           RETURNING id`, [ctx.org, item.id, ctx.def.id, product.id]));
                if (!units.length)
                    return;
                await this.ledger.apply({ organizationId: ctx.org, actorUserId: p.userId ?? null }, units.map((u) => ({ itemId: item.id, warehouseId: ctx.def.id, type: 'receipt', onHand: 1, unitId: u.id, note: 'Serialized B&I unit registered' })), em);
            });
            this.ops.afterReceipt(ctx.org, [item.id]);
        }
        catch (err) {
            this.logger.warn(`B&I unit stock sync failed for ${p.catalogProductId}: ${err.message}`);
        }
    }
    async onFashionWarehouse(p) {
        try {
            await this.db.query(`INSERT INTO warehouses (organization_id, code, name, country_code, active, legacy_fashion_warehouse_id)
         SELECT organization_id, code, name, country_code, active, id FROM fashion_warehouses WHERE id = $1 AND organization_id = $2
         ON CONFLICT (organization_id, code) DO UPDATE
           SET name = EXCLUDED.name, country_code = EXCLUDED.country_code,
               active = CASE WHEN warehouses.is_default THEN true ELSE EXCLUDED.active END,
               legacy_fashion_warehouse_id = EXCLUDED.legacy_fashion_warehouse_id, updated_at = now()`, [p.fashionWarehouseId, p.organizationId]);
        }
        catch (err) {
            this.logger.warn(`Fashion warehouse mirror failed: ${err.message}`);
        }
    }
};
exports.StockIntakeListener = StockIntakeListener;
__decorate([
    (0, event_emitter_1.OnEvent)(exports.STOCK_INTAKE_EVENT, { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockIntakeListener.prototype, "onIntake", null);
__decorate([
    (0, event_emitter_1.OnEvent)(exports.STOCK_BI_UNITS_EVENT, { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockIntakeListener.prototype, "onBiUnits", null);
__decorate([
    (0, event_emitter_1.OnEvent)(exports.STOCK_FASHION_WAREHOUSE_EVENT, { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockIntakeListener.prototype, "onFashionWarehouse", null);
exports.StockIntakeListener = StockIntakeListener = StockIntakeListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        user_organization_service_js_1.UserOrganizationService,
        inventory_items_service_js_1.InventoryItemsService,
        stock_operations_service_js_1.StockOperationsService,
        stock_ledger_service_js_1.StockLedgerService])
], StockIntakeListener);
//# sourceMappingURL=stock-intake.listener.js.map