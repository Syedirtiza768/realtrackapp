import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { TrackingMode, Warehouse, WarehouseLocation } from './entities/index.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockOperationsService } from './stock-operations.service.js';

/**
 * Events emitted by vertical intake flows. Emitters must not depend on the stock module;
 * when an organization has not set up stock (no default warehouse) the events are ignored.
 */
export const STOCK_INTAKE_EVENT = 'stock.intake.received';
export const STOCK_BI_UNITS_EVENT = 'stock.bi-units.saved';
export const STOCK_FASHION_WAREHOUSE_EVENT = 'stock.fashion-warehouse.saved';

export interface StockIntakePayload {
  organizationId?: string | null;
  userId?: string | null;
  sku: string;
  vertical: string;
  quantity: number;
  catalogProductId?: string | null;
  listingRecordId?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  trackingMode?: TrackingMode;
  warehouseCode?: string | null;
  /** Bin code (or free-text shelf label from the intake form). */
  binCode?: string | null;
  conditionId?: string | null;
  lotCode?: string | null;
  unitCost?: number | null;
  /** Stable key so a retried intake is never received twice. */
  idempotencyKey: string;
}

@Injectable()
export class StockIntakeListener {
  private readonly logger = new Logger(StockIntakeListener.name);

  constructor(
    private readonly db: DataSource,
    private readonly userOrgs: UserOrganizationService,
    private readonly items: InventoryItemsService,
    private readonly ops: StockOperationsService,
    private readonly ledger: StockLedgerService,
  ) {}

  private async enabledOrg(organizationId?: string | null, userId?: string | null) {
    let org = organizationId ?? null;
    if (!org && userId) org = (await this.userOrgs.resolveOrganizationId(userId)).organizationId;
    if (!org) return null;
    const def = await this.db.getRepository(Warehouse).findOneBy({ organizationId: org, isDefault: true });
    return def ? { org, def } : null;
  }

  @OnEvent(STOCK_INTAKE_EVENT, { async: true, promisify: true })
  async onIntake(p: StockIntakePayload) {
    try {
      if (!p.sku?.trim() || !(p.quantity > 0)) return;
      const ctx = await this.enabledOrg(p.organizationId, p.userId);
      if (!ctx) return;
      const warehouse =
        (p.warehouseCode
          ? await this.db.getRepository(Warehouse).findOneBy({ organizationId: ctx.org, code: p.warehouseCode.trim().toUpperCase(), active: true })
          : null) ?? ctx.def;
      const bin = p.binCode?.trim()
        ? await this.db.getRepository(WarehouseLocation).findOneBy({ warehouseId: warehouse.id, code: p.binCode.trim().toUpperCase(), active: true })
        : null;
      let catalogProductId = p.catalogProductId ?? null;
      if (!catalogProductId) {
        const [c] = (await this.db.query(
          `SELECT id FROM catalog_products WHERE sku = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`,
          [p.sku.trim(), ctx.org],
        )) as Array<{ id: string }>;
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
      await this.ops.receive(
        { organizationId: ctx.org, userId: p.userId ?? null, warehouseIds: null },
        {
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
        },
      );
    } catch (err) {
      this.logger.warn(`Intake stock receipt failed for ${p.sku}: ${(err as Error).message}`);
    }
  }

  /** B&I serialized units saved on a listing → received as serial units in the default warehouse. */
  @OnEvent(STOCK_BI_UNITS_EVENT, { async: true, promisify: true })
  async onBiUnits(p: { organizationId: string; catalogProductId: string; userId?: string | null }) {
    try {
      const ctx = await this.enabledOrg(p.organizationId);
      if (!ctx) return;
      const [product] = (await this.db.query(
        `SELECT id, sku, title, image_urls[1] AS image FROM catalog_products WHERE id = $1 AND organization_id = $2`,
        [p.catalogProductId, ctx.org],
      )) as Array<{ id: string; sku: string | null; title: string | null; image: string | null }>;
      if (!product?.sku) return;
      const item = await this.items.findOrCreate(this.db.manager, ctx.org, {
        sku: product.sku,
        vertical: 'business_industrial',
        title: product.title,
        imageUrl: product.image,
        catalogProductId: product.id,
        trackingMode: 'serial',
      });
      await this.db.transaction('READ COMMITTED', async (em) => {
        const units = (await em.query(
          `INSERT INTO inventory_units (organization_id, inventory_item_id, warehouse_id, serial_private, serial_public, status, source_ref, received_at)
           SELECT $1, $2, $3, u.serial_number_private, u.serial_number_public, 'available', 'bi_unit:' || u.id, now()
             FROM business_industrial_units u
            WHERE u.organization_id = $1 AND u.catalog_product_id = $4 AND u.status IN ('available','allocated')
           ON CONFLICT (source_ref) WHERE source_ref IS NOT NULL DO NOTHING
           RETURNING id`,
          [ctx.org, item.id, ctx.def.id, product.id],
        )) as Array<{ id: string }>;
        if (!units.length) return;
        await this.ledger.apply(
          { organizationId: ctx.org, actorUserId: p.userId ?? null },
          units.map((u) => ({ itemId: item.id, warehouseId: ctx.def.id, type: 'receipt' as const, onHand: 1, unitId: u.id, note: 'Serialized B&I unit registered' })),
          em,
        );
      });
      this.ops.afterReceipt(ctx.org, [item.id]);
    } catch (err) {
      this.logger.warn(`B&I unit stock sync failed for ${p.catalogProductId}: ${(err as Error).message}`);
    }
  }

  /** Keeps `warehouses` in step with Fashion's warehouse picker. */
  @OnEvent(STOCK_FASHION_WAREHOUSE_EVENT, { async: true, promisify: true })
  async onFashionWarehouse(p: { organizationId: string; fashionWarehouseId: string }) {
    try {
      await this.db.query(
        `INSERT INTO warehouses (organization_id, code, name, country_code, active, legacy_fashion_warehouse_id)
         SELECT organization_id, code, name, country_code, active, id FROM fashion_warehouses WHERE id = $1 AND organization_id = $2
         ON CONFLICT (organization_id, code) DO UPDATE
           SET name = EXCLUDED.name, country_code = EXCLUDED.country_code,
               active = CASE WHEN warehouses.is_default THEN true ELSE EXCLUDED.active END,
               legacy_fashion_warehouse_id = EXCLUDED.legacy_fashion_warehouse_id, updated_at = now()`,
        [p.fashionWarehouseId, p.organizationId],
      );
    } catch (err) {
      this.logger.warn(`Fashion warehouse mirror failed: ${(err as Error).message}`);
    }
  }
}
