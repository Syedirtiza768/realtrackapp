import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BootstrapDto } from './dto/stock.dto.js';
import { InventoryItem } from './entities/index.js';
import { StockScope } from './stock-access.service.js';
import { StockLedgerService, StockMovementCommand } from './stock-ledger.service.js';
import { WarehousesService } from './warehouses.service.js';

class DryRunRollback extends Error {
  constructor(readonly report: BootstrapReport) {
    super('dry run');
  }
}

export interface BootstrapReport {
  dryRun: boolean;
  defaultWarehouse: { id: string; code: string };
  warehousesFromFashion: number;
  items: { fromCatalog: number; fromListings: number; fromVariants: number; total: number };
  serialUnitsImported: number;
  openingBalances: { items: number; units: number; skippedAlreadyStocked: number };
  storesLinked: number;
  conflicts: Array<{ kind: string; sku: string; detail: string }>;
}

/**
 * One-time (re-runnable) setup of warehouse inventory for an organization.
 *
 * Idempotent: items upsert on (org, sku); B&I units on source_ref; opening balances use
 * operation key `opening:<itemId>` and are skipped for items that already have stock rows.
 * Product rows are never modified except through the ledger's legacy quantity projection.
 * Channel push stays OFF — every store starts in shadow mode.
 */
@Injectable()
export class StockSetupService {
  private readonly logger = new Logger(StockSetupService.name);

  constructor(
    private readonly db: DataSource,
    private readonly ledger: StockLedgerService,
    private readonly warehouses: WarehousesService,
  ) {}

  /** fashion_warehouses only exists once the Fashion quick-capture migration has run. */
  private async hasFashionWarehouses(em: EntityManager): Promise<boolean> {
    const [row] = (await em.query(`SELECT to_regclass('fashion_warehouses') IS NOT NULL AS ok`)) as Array<{ ok: boolean }>;
    return !!row?.ok;
  }

  async status(scope: StockScope) {
    const fashion = await this.hasFashionWarehouses(this.db.manager);
    const [row] = (await this.db.query(
      `SELECT (SELECT count(*)::int FROM warehouses WHERE organization_id = $1) AS warehouses,
              (SELECT count(*)::int FROM inventory_items WHERE organization_id = $1) AS items,
              (SELECT count(*)::int FROM stock_movements WHERE organization_id = $1) AS movements,
              (SELECT count(*)::int FROM stores WHERE organization_id = $1) AS stores,
              (SELECT count(DISTINCT store_id)::int FROM store_warehouse_links WHERE organization_id = $1) AS "linkedStores",
              (SELECT count(*)::int FROM catalog_products WHERE organization_id = $1 AND sku IS NOT NULL) AS "catalogProducts",
              ${fashion ? '(SELECT count(*)::int FROM fashion_warehouses WHERE organization_id = $1)' : '0'} AS "fashionWarehouses"`,
      [scope.organizationId],
    )) as Array<Record<string, number>>;
    return { ...row, initialized: row.items > 0 || row.movements > 0 };
  }

  async bootstrap(scope: StockScope, dto: BootstrapDto): Promise<BootstrapReport> {
    const dryRun = dto.dryRun ?? true;
    try {
      const report = await this.db.transaction('READ COMMITTED', async (em) => {
        const r = await this.run(em, scope, dto, dryRun);
        if (dryRun) throw new DryRunRollback(r);
        return r;
      });
      this.ledger.emitChanged(scope.organizationId, []);
      this.logger.log(`Stock bootstrap for ${scope.organizationId}: ${JSON.stringify({ ...report, conflicts: report.conflicts.length })}`);
      return report;
    } catch (err) {
      if (err instanceof DryRunRollback) return err.report;
      throw err;
    }
  }

  private async run(em: EntityManager, scope: StockScope, dto: BootstrapDto, dryRun: boolean): Promise<BootstrapReport> {
    const org = scope.organizationId;
    const conflicts: BootstrapReport['conflicts'] = [];

    // 1. Warehouses (Fashion warehouses become real warehouses with the same codes).
    const fashion = !(await this.hasFashionWarehouses(em)) ? [] : (await em.query(
      `INSERT INTO warehouses (organization_id, code, name, country_code, active, legacy_fashion_warehouse_id)
       SELECT organization_id, code, name, country_code, active, id FROM fashion_warehouses WHERE organization_id = $1
       ON CONFLICT (organization_id, code) DO NOTHING
       RETURNING id`,
      [org],
    )) as Array<{ id: string }>;
    const def = await this.warehouses.ensureDefault(org, em, dto.defaultWarehouseCode ?? 'MAIN', dto.defaultWarehouseName ?? 'Main warehouse');
    if (!def.ebayMerchantLocationKey) {
      const [store] = (await em.query(
        `SELECT location_key FROM stores WHERE organization_id = $1 AND channel = 'ebay' AND location_key IS NOT NULL ORDER BY is_primary DESC, created_at LIMIT 1`,
        [org],
      )) as Array<{ location_key: string }>;
      if (store) await em.query(`UPDATE warehouses SET ebay_merchant_location_key = $2 WHERE id = $1`, [def.id, store.location_key]);
    }

    // 2. SKU master from catalog products.
    const unscoped = dto.claimUnscopedAutomotive ? `OR (c.organization_id IS NULL AND COALESCE(c.vertical, 'automotive') = 'automotive')` : '';
    const fromCatalog = (await em.query(
      `INSERT INTO inventory_items (organization_id, sku, vertical, title, image_url, catalog_product_id, tracking_mode, sourcing_mode)
       SELECT $1, c.sku, COALESCE(c.vertical, 'automotive'), c.title, c.image_urls[1], c.id,
              CASE WHEN c.vertical = 'fashion' THEN 'one_off'
                   WHEN c.vertical = 'business_industrial' AND c.vertical_attributes->>'inventoryMode' = 'serialized' THEN 'serial'
                   ELSE 'quantity' END,
              'stocked'
         FROM catalog_products c
        WHERE c.sku IS NOT NULL AND btrim(c.sku) <> ''
          AND (c.organization_id = $1 ${unscoped})
          AND NOT EXISTS (SELECT 1 FROM inventory_items x WHERE x.catalog_product_id = c.id AND x.organization_id <> $1)
       ON CONFLICT (organization_id, sku) DO UPDATE
         SET catalog_product_id = COALESCE(inventory_items.catalog_product_id, EXCLUDED.catalog_product_id),
             title = COALESCE(inventory_items.title, EXCLUDED.title),
             image_url = COALESCE(inventory_items.image_url, EXCLUDED.image_url)
       RETURNING (xmax = 0) AS inserted`,
      [org],
    )) as Array<{ inserted: boolean }>;

    // 3. SKU master from listing records (newest row wins per SKU).
    const dupes = (await em.query(
      `SELECT "customLabelSku" AS sku, count(*)::int n FROM listing_records
        WHERE "deletedAt" IS NULL AND "customLabelSku" IS NOT NULL
          AND (organization_id = $1 ${dto.claimUnscopedAutomotive ? 'OR organization_id IS NULL' : ''})
        GROUP BY 1 HAVING count(*) > 1 LIMIT 200`,
      [org],
    )) as Array<{ sku: string; n: number }>;
    for (const d of dupes) conflicts.push({ kind: 'duplicate_listing_sku', sku: d.sku, detail: `${d.n} listing records share this SKU; the newest was linked` });
    const fromListings = (await em.query(
      `INSERT INTO inventory_items (organization_id, sku, vertical, title, image_url, listing_record_id, tracking_mode, sourcing_mode)
       SELECT DISTINCT ON (l."customLabelSku") $1, l."customLabelSku", 'automotive', l.title,
              NULLIF(split_part(COALESCE(l."itemPhotoUrl", ''), '|', 1), ''), l.id, 'quantity', 'stocked'
         FROM listing_records l
        WHERE l."deletedAt" IS NULL AND l."customLabelSku" IS NOT NULL AND btrim(l."customLabelSku") <> ''
          AND (l.organization_id = $1 ${dto.claimUnscopedAutomotive ? 'OR l.organization_id IS NULL' : ''})
          AND NOT EXISTS (SELECT 1 FROM inventory_items x WHERE x.listing_record_id = l.id AND x.organization_id <> $1)
        ORDER BY l."customLabelSku", l."updatedAt" DESC
       ON CONFLICT (organization_id, sku) DO UPDATE
         SET listing_record_id = COALESCE(inventory_items.listing_record_id, EXCLUDED.listing_record_id),
             title = COALESCE(inventory_items.title, EXCLUDED.title),
             image_url = COALESCE(inventory_items.image_url, EXCLUDED.image_url)
       RETURNING (xmax = 0) AS inserted`,
      [org],
    )) as Array<{ inserted: boolean }>;

    // 4. SKU master from product variants.
    const fromVariants = (await em.query(
      `INSERT INTO inventory_items (organization_id, sku, vertical, product_variant_id, catalog_product_id, tracking_mode, sourcing_mode)
       SELECT DISTINCT ON (v.sku) $1, v.sku, v.vertical, v.id, v.catalog_product_id, 'quantity', 'stocked'
         FROM product_variants v
        WHERE v.organization_id = $1 AND v.active
        ORDER BY v.sku, v.updated_at DESC
       ON CONFLICT (organization_id, sku) DO UPDATE
         SET product_variant_id = COALESCE(inventory_items.product_variant_id, EXCLUDED.product_variant_id)
       RETURNING (xmax = 0) AS inserted`,
      [org],
    )) as Array<{ inserted: boolean }>;

    // 5. B&I serialized units.
    const biUnits = (await em.query(
      `INSERT INTO inventory_units (organization_id, inventory_item_id, warehouse_id, serial_private, serial_public,
                                    status, source_ref, received_at)
       SELECT $1, i.id, $2, u.serial_number_private, u.serial_number_public,
              CASE u.status WHEN 'sold' THEN 'shipped' WHEN 'quarantined' THEN 'quarantined' ELSE 'available' END,
              'bi_unit:' || u.id, u.created_at
         FROM business_industrial_units u
         JOIN inventory_items i ON i.organization_id = $1 AND i.catalog_product_id = u.catalog_product_id
        WHERE u.organization_id = $1
       ON CONFLICT (source_ref) WHERE source_ref IS NOT NULL DO NOTHING
       RETURNING id, inventory_item_id, status`,
      [org, def.id],
    )) as Array<{ id: string; inventory_item_id: string; status: string }>;
    if (biUnits.length)
      await em.query(
        `UPDATE inventory_units SET warehouse_id = NULL WHERE id = ANY($1::uuid[]) AND status = 'shipped'`,
        [biUnits.map((u) => u.id)],
      );

    // 6. Opening balances.
    let openingItems = 0;
    let openingUnits = 0;
    let skipped = 0;
    if (dto.openingBalances !== false) {
      const unitsByItem = new Map<string, Array<{ id: string; status: string }>>();
      for (const u of biUnits) if (u.status !== 'shipped') unitsByItem.set(u.inventory_item_id, [...(unitsByItem.get(u.inventory_item_id) ?? []), u]);
      for (const [itemId, units] of unitsByItem) {
        const commands: StockMovementCommand[] = units.map((u) => ({
          itemId,
          warehouseId: def.id,
          type: 'opening_balance',
          onHand: 1,
          damaged: u.status === 'quarantined' ? 1 : 0,
          unitId: u.id,
          note: 'Imported from Business & Industrial serialized units',
        }));
        await this.ledger.apply({ organizationId: org, actorUserId: scope.userId, operationKey: `opening-units:${itemId}:${units.length}` }, commands, em);
        openingItems++;
        openingUnits += units.length;
      }

      const candidates = (await em.query(
        `SELECT i.id, i.tracking_mode,
                GREATEST(COALESCE(v.quantity, c.quantity, l."quantityNum", 0), 0)::int AS qty,
                EXISTS (SELECT 1 FROM stock_levels sl WHERE sl.inventory_item_id = i.id) AS stocked
           FROM inventory_items i
           LEFT JOIN product_variants v ON v.id = i.product_variant_id
           LEFT JOIN catalog_products c ON c.id = i.catalog_product_id
           LEFT JOIN listing_records l ON l.id = i.listing_record_id
          WHERE i.organization_id = $1 AND i.tracking_mode <> 'serial'`,
        [org],
      )) as Array<{ id: string; tracking_mode: string; qty: number; stocked: boolean }>;
      for (const c of candidates) {
        if (c.stocked) { skipped++; continue; }
        if (c.qty <= 0) continue;
        if (c.qty > 100_000) {
          conflicts.push({ kind: 'implausible_quantity', sku: c.id, detail: `Quantity ${c.qty} skipped` });
          continue;
        }
        let commands: StockMovementCommand[] = [{ itemId: c.id, warehouseId: def.id, type: 'opening_balance', onHand: c.qty, note: 'Opening balance from product quantity' }];
        if (c.tracking_mode === 'one_off') {
          const units = (await em.query(
            `INSERT INTO inventory_units (organization_id, inventory_item_id, warehouse_id, status, received_at)
             SELECT $1, $2, $3, 'available', now() FROM generate_series(1, $4) RETURNING id`,
            [org, c.id, def.id, c.qty],
          )) as Array<{ id: string }>;
          commands = units.map((u) => ({ itemId: c.id, warehouseId: def.id, type: 'opening_balance', onHand: 1, unitId: u.id, note: 'Opening balance from product quantity' }));
          openingUnits += units.length;
        }
        const res = await this.ledger.apply({ organizationId: org, actorUserId: scope.userId, operationKey: `opening:${c.id}` }, commands, em);
        if (!res.replayed) openingItems++;
      }
    }

    // 7. Link every store to the default warehouse (shadow mode) unless already linked.
    const linked = (await em.query(
      `INSERT INTO store_warehouse_links (organization_id, store_id, warehouse_id, priority)
       SELECT $1, s.id, $2, 10 FROM stores s
        WHERE s.organization_id = $1 AND s.status <> 'archived'
          AND NOT EXISTS (SELECT 1 FROM store_warehouse_links l WHERE l.store_id = s.id)
       RETURNING store_id`,
      [org, def.id],
    )) as Array<{ store_id: string }>;
    const stores = (await em.query(`SELECT id FROM stores WHERE organization_id = $1`, [org])) as Array<{ id: string }>;
    for (const s of stores) {
      await this.warehouses.ensurePolicy(em, org, s.id);
      await this.warehouses.markStoreDirty(em, org, s.id);
    }

    const total = await em.getRepository(InventoryItem).countBy({ organizationId: org });
    return {
      dryRun,
      defaultWarehouse: { id: def.id, code: def.code },
      warehousesFromFashion: fashion.length,
      items: {
        fromCatalog: fromCatalog.filter((r) => r.inserted).length,
        fromListings: fromListings.filter((r) => r.inserted).length,
        fromVariants: fromVariants.filter((r) => r.inserted).length,
        total,
      },
      serialUnitsImported: biUnits.length,
      openingBalances: { items: openingItems, units: openingUnits, skippedAlreadyStocked: skipped },
      storesLinked: linked.length,
      conflicts,
    };
  }
}
