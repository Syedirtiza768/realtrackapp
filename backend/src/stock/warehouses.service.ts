import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  StoreStockPolicy,
  StoreWarehouseLink,
  UserWarehouseAssignment,
  Warehouse,
  WarehouseLocation,
} from './entities/index.js';
import {
  GenerateLocationsDto,
  LocationDto,
  SetStoreLinksDto,
  StorePolicyDto,
  UpdateLocationDto,
  UpdateWarehouseDto,
  WarehouseDto,
} from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService, isUniqueViolation } from './stock-ledger.service.js';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly db: DataSource,
    private readonly access: StockAccessService,
    private readonly ledger: StockLedgerService,
  ) {}

  /* ── Warehouses ─────────────────────────────────────────────────── */

  async list(scope: StockScope, includeInactive = false) {
    const params: unknown[] = [scope.organizationId];
    const filter = this.access.warehouseFilter(scope, 'w.id', params);
    return this.db.query(
      `SELECT w.id, w.code, w.name, w.type, w.country_code AS "countryCode", w.timezone,
              w.address, w.ebay_merchant_location_key AS "ebayMerchantLocationKey",
              w.is_default AS "isDefault", w.is_sellable AS "isSellable", w.active,
              w.created_at AS "createdAt",
              COALESCE(s.on_hand, 0)::int AS "onHand", COALESCE(s.available, 0)::int AS "available",
              COALESCE(s.reserved, 0)::int AS "reserved", COALESCE(s.inbound, 0)::int AS "inbound",
              COALESCE(s.skus, 0)::int AS "skuCount",
              (SELECT count(*)::int FROM warehouse_locations l WHERE l.warehouse_id = w.id AND l.active) AS "locationCount"
         FROM warehouses w
         LEFT JOIN (
           SELECT warehouse_id, SUM(on_hand) on_hand, SUM(available) available, SUM(reserved) reserved,
                  SUM(inbound) inbound, COUNT(DISTINCT inventory_item_id) FILTER (WHERE on_hand > 0) skus
             FROM stock_levels GROUP BY warehouse_id
         ) s ON s.warehouse_id = w.id
        WHERE w.organization_id = $1 AND ${filter} ${includeInactive ? '' : 'AND w.active'}
        ORDER BY w.is_default DESC, w.code`,
      params,
    );
  }

  async get(scope: StockScope, id: string) {
    const w = await this.db
      .getRepository(Warehouse)
      .findOneBy({ id, organizationId: scope.organizationId });
    if (!w) throw new NotFoundException('Warehouse not found');
    this.access.assertWarehouse(scope, w.id);
    return w;
  }

  async create(scope: StockScope, dto: WarehouseDto) {
    return this.db.transaction(async (em) => {
      const repo = em.getRepository(Warehouse);
      const code = dto.code.trim().toUpperCase();
      if (await repo.existsBy({ organizationId: scope.organizationId, code }))
        throw new ConflictException(`Warehouse ${code} already exists`);
      const hasDefault = await repo.existsBy({
        organizationId: scope.organizationId,
        isDefault: true,
      });
      const makeDefault = dto.isDefault ?? !hasDefault;
      if (makeDefault) await this.clearDefault(em, scope.organizationId);
      return repo.save(
        repo.create({
          organizationId: scope.organizationId,
          code,
          name: dto.name.trim(),
          type: dto.type ?? 'owned',
          countryCode: dto.countryCode?.toUpperCase() ?? null,
          timezone: dto.timezone ?? null,
          address: dto.address ?? null,
          ebayMerchantLocationKey: dto.ebayMerchantLocationKey?.trim() || null,
          isDefault: makeDefault,
          isSellable: dto.isSellable ?? dto.type !== 'virtual',
          active: dto.active ?? true,
        }),
      );
    });
  }

  async update(scope: StockScope, id: string, dto: UpdateWarehouseDto) {
    return this.db.transaction(async (em) => {
      const repo = em.getRepository(Warehouse);
      const w = await repo.findOneBy({ id, organizationId: scope.organizationId });
      if (!w) throw new NotFoundException('Warehouse not found');
      if (dto.active === false && w.isDefault)
        throw new BadRequestException(
          'Make another warehouse the default before deactivating this one',
        );
      if (dto.isDefault === true && !w.isDefault)
        await this.clearDefault(em, scope.organizationId);
      if (dto.isDefault === false && w.isDefault)
        throw new BadRequestException(
          'Choose a different default warehouse instead of unsetting this one',
        );
      const sellabilityChanged =
        (dto.isSellable !== undefined && dto.isSellable !== w.isSellable) ||
        (dto.active !== undefined && dto.active !== w.active);
      Object.assign(w, {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.countryCode !== undefined
          ? { countryCode: dto.countryCode.toUpperCase() || null }
          : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.ebayMerchantLocationKey !== undefined
          ? { ebayMerchantLocationKey: dto.ebayMerchantLocationKey.trim() || null }
          : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isSellable !== undefined ? { isSellable: dto.isSellable } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      });
      const saved = await repo.save(w);
      if (sellabilityChanged) {
        const items = (await em.query(
          `SELECT DISTINCT inventory_item_id AS id FROM stock_levels WHERE warehouse_id = $1`,
          [id],
        )) as Array<{ id: string }>;
        await this.ledger.markChannelDirty(
          em,
          scope.organizationId,
          items.map((i) => i.id),
        );
      }
      return saved;
    });
  }

  /** Returns the org's default warehouse, creating `MAIN` if the org has none. */
  async ensureDefault(
    organizationId: string,
    em: EntityManager = this.db.manager,
    code = 'MAIN',
    name = 'Main warehouse',
  ): Promise<Warehouse> {
    const repo = em.getRepository(Warehouse);
    const existing = await repo.findOne({
      where: { organizationId, isDefault: true },
    });
    if (existing) return existing;
    const anyActive = await repo.findOne({
      where: { organizationId, active: true },
      order: { createdAt: 'ASC' },
    });
    if (anyActive) {
      anyActive.isDefault = true;
      return repo.save(anyActive);
    }
    try {
      return await repo.save(
        repo.create({ organizationId, code, name, isDefault: true }),
      );
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return repo.findOneOrFail({ where: { organizationId, isDefault: true } });
    }
  }

  private async clearDefault(em: EntityManager, organizationId: string) {
    await em.query(
      `UPDATE warehouses SET is_default = false, updated_at = now() WHERE organization_id = $1 AND is_default`,
      [organizationId],
    );
  }

  /* ── Bins ───────────────────────────────────────────────────────── */

  async listLocations(scope: StockScope, warehouseId: string, includeInactive = false) {
    await this.get(scope, warehouseId);
    return this.db.query(
      `SELECT l.id, l.code, l.zone, l.aisle, l.rack, l.shelf, l.bin, l.barcode, l.type,
              l.is_pickable AS "isPickable", l.capacity_units AS "capacityUnits", l.active,
              COALESCE(SUM(sl.on_hand), 0)::int AS "onHand",
              COUNT(DISTINCT sl.inventory_item_id) FILTER (WHERE sl.on_hand > 0)::int AS "skuCount"
         FROM warehouse_locations l
         LEFT JOIN stock_levels sl ON sl.location_id = l.id
        WHERE l.warehouse_id = $1 ${includeInactive ? '' : 'AND l.active'}
        GROUP BY l.id
        ORDER BY l.code`,
      [warehouseId],
    );
  }

  async createLocation(scope: StockScope, warehouseId: string, dto: LocationDto) {
    await this.get(scope, warehouseId);
    const repo = this.db.getRepository(WarehouseLocation);
    const code = dto.code.trim().toUpperCase();
    if (await repo.existsBy({ warehouseId, code }))
      throw new ConflictException(`Bin ${code} already exists in this warehouse`);
    return repo.save(
      repo.create({
        organizationId: scope.organizationId,
        warehouseId,
        code,
        zone: dto.zone ?? null,
        aisle: dto.aisle ?? null,
        rack: dto.rack ?? null,
        shelf: dto.shelf ?? null,
        bin: dto.bin ?? null,
        barcode: dto.barcode?.trim() || code,
        type: dto.type ?? 'storage',
        isPickable: dto.isPickable ?? !['quarantine', 'returns'].includes(dto.type ?? ''),
        capacityUnits: dto.capacityUnits ?? null,
        active: dto.active ?? true,
      }),
    );
  }

  async generateLocations(scope: StockScope, warehouseId: string, dto: GenerateLocationsDto) {
    await this.get(scope, warehouseId);
    const prefix = (dto.prefix ?? '').toUpperCase();
    const rows: Array<Partial<WarehouseLocation>> = [];
    for (const rawAisle of dto.aisles) {
      const aisle = rawAisle.trim().toUpperCase();
      if (!/^[A-Z0-9]{1,4}$/.test(aisle))
        throw new BadRequestException(`Invalid aisle "${rawAisle}"`);
      for (let r = 1; r <= dto.racks; r++) {
        for (let s = 1; s <= dto.shelves; s++) {
          const rack = String(r).padStart(2, '0');
          const code = `${prefix}${aisle}-${rack}-${s}`;
          rows.push({
            organizationId: scope.organizationId,
            warehouseId,
            code,
            zone: dto.zone ?? null,
            aisle,
            rack,
            shelf: String(s),
            barcode: code,
            type: 'storage',
            isPickable: true,
            active: true,
          });
        }
      }
    }
    if (rows.length > 2000)
      throw new BadRequestException('Generate at most 2000 bins at a time');
    const result = await this.db
      .createQueryBuilder()
      .insert()
      .into(WarehouseLocation)
      .values(rows)
      .orIgnore()
      .execute();
    return { requested: rows.length, created: result.identifiers.filter(Boolean).length };
  }

  async updateLocation(scope: StockScope, locationId: string, dto: UpdateLocationDto) {
    const repo = this.db.getRepository(WarehouseLocation);
    const loc = await repo.findOneBy({ id: locationId, organizationId: scope.organizationId });
    if (!loc) throw new NotFoundException('Bin not found');
    this.access.assertWarehouse(scope, loc.warehouseId);
    if (dto.active === false) {
      const [{ qty }] = (await this.db.query(
        `SELECT COALESCE(SUM(on_hand),0)::int qty FROM stock_levels WHERE location_id = $1`,
        [locationId],
      )) as Array<{ qty: number }>;
      if (qty > 0)
        throw new BadRequestException(`Move the ${qty} unit(s) out of ${loc.code} before deactivating it`);
    }
    Object.assign(loc, dto);
    return repo.save(loc);
  }

  /* ── Store links & channel policy ───────────────────────────────── */

  async storeOverview(scope: StockScope) {
    return this.db.query(
      `SELECT s.id, s.store_name AS "storeName", s.channel, s.status,
              COALESCE(p.push_enabled, false) AS "pushEnabled",
              COALESCE(p.buffer_qty, 0) AS "bufferQty", p.max_qty AS "maxQty",
              COALESCE(p.include_sourceable, true) AS "includeSourceable",
              COALESCE(p.max_sourceable_qty, 5) AS "maxSourceableQty",
              COALESCE(json_agg(json_build_object(
                'warehouseId', l.warehouse_id, 'priority', l.priority, 'active', l.active,
                'code', w.code, 'name', w.name
              ) ORDER BY l.priority) FILTER (WHERE l.id IS NOT NULL), '[]') AS links,
              (SELECT json_object_agg(st, n) FROM (
                 SELECT status st, count(*)::int n FROM channel_stock_sync_state c
                  WHERE c.store_id = s.id GROUP BY status) x) AS "syncCounts"
         FROM stores s
         LEFT JOIN store_stock_policies p ON p.store_id = s.id
         LEFT JOIN store_warehouse_links l ON l.store_id = s.id
         LEFT JOIN warehouses w ON w.id = l.warehouse_id
        WHERE s.organization_id = $1
        GROUP BY s.id, p.store_id
        ORDER BY s.store_name`,
      [scope.organizationId],
    );
  }

  private async assertStore(em: EntityManager, scope: StockScope, storeId: string) {
    const [store] = (await em.query(
      `SELECT id FROM stores WHERE id = $1 AND organization_id = $2`,
      [storeId, scope.organizationId],
    )) as Array<{ id: string }>;
    if (!store) throw new NotFoundException('Store not found in this workspace');
  }

  async setStoreLinks(scope: StockScope, storeId: string, dto: SetStoreLinksDto) {
    return this.db.transaction(async (em) => {
      await this.assertStore(em, scope, storeId);
      const whIds = dto.links.map((l) => l.warehouseId);
      if (new Set(whIds).size !== whIds.length)
        throw new BadRequestException('Each warehouse can only be linked once');
      if (whIds.length) {
        const count = await em.getRepository(Warehouse).countBy({
          organizationId: scope.organizationId,
          id: In(whIds),
        });
        if (count !== whIds.length)
          throw new BadRequestException('Unknown warehouse for this workspace');
      }
      const repo = em.getRepository(StoreWarehouseLink);
      await repo.delete({ storeId });
      await repo.save(
        dto.links.map((l, i) =>
          repo.create({
            organizationId: scope.organizationId,
            storeId,
            warehouseId: l.warehouseId,
            priority: l.priority ?? (i + 1) * 10,
            active: l.active ?? true,
          }),
        ),
      );
      await this.ensurePolicy(em, scope.organizationId, storeId);
      await this.markStoreDirty(em, scope.organizationId, storeId);
      return repo.find({ where: { storeId }, order: { priority: 'ASC' } });
    });
  }

  async setStorePolicy(scope: StockScope, storeId: string, dto: StorePolicyDto) {
    return this.db.transaction(async (em) => {
      await this.assertStore(em, scope, storeId);
      const policy = await this.ensurePolicy(em, scope.organizationId, storeId);
      Object.assign(policy, {
        ...(dto.pushEnabled !== undefined ? { pushEnabled: dto.pushEnabled } : {}),
        ...(dto.bufferQty !== undefined ? { bufferQty: dto.bufferQty } : {}),
        ...(dto.maxQty !== undefined ? { maxQty: dto.maxQty } : {}),
        ...(dto.includeSourceable !== undefined ? { includeSourceable: dto.includeSourceable } : {}),
        ...(dto.maxSourceableQty !== undefined ? { maxSourceableQty: dto.maxSourceableQty } : {}),
      });
      const saved = await em.getRepository(StoreStockPolicy).save(policy);
      await this.markStoreDirty(em, scope.organizationId, storeId);
      return saved;
    });
  }

  async ensurePolicy(em: EntityManager, organizationId: string, storeId: string) {
    const repo = em.getRepository(StoreStockPolicy);
    const existing = await repo.findOneBy({ storeId });
    if (existing) return existing;
    await em.query(
      `INSERT INTO store_stock_policies (store_id, organization_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [storeId, organizationId],
    );
    return repo.findOneByOrFail({ storeId });
  }

  /** Every item that is stocked in, or sourceable for, this org gets recomputed for the store. */
  async markStoreDirty(em: EntityManager, organizationId: string, storeId: string) {
    await em.query(
      `INSERT INTO channel_stock_sync_state (store_id, inventory_item_id, organization_id, dirty, status, updated_at)
       SELECT $2::uuid, i.id, $1::uuid, true, 'pending', now()
         FROM inventory_items i
        WHERE i.organization_id = $1 AND i.status = 'active'
          AND (EXISTS (SELECT 1 FROM stock_levels sl WHERE sl.inventory_item_id = i.id)
               OR EXISTS (SELECT 1 FROM inventory_item_sources s WHERE s.inventory_item_id = i.id AND s.active))
       ON CONFLICT (store_id, inventory_item_id) DO UPDATE SET dirty = true, updated_at = now()`,
      [organizationId, storeId],
    );
  }

  /* ── User warehouse assignments ─────────────────────────────────── */

  async getAssignments(scope: StockScope, userId: string) {
    return this.db.getRepository(UserWarehouseAssignment).find({
      where: { userId, organizationId: scope.organizationId },
    });
  }

  async setAssignments(scope: StockScope, userId: string, warehouseIds: string[]) {
    return this.db.transaction(async (em) => {
      const [member] = (await em.query(
        `SELECT 1 FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
        [userId, scope.organizationId],
      )) as unknown[];
      if (!member) throw new NotFoundException('User is not a member of this workspace');
      if (warehouseIds.length) {
        const count = await em.getRepository(Warehouse).countBy({
          organizationId: scope.organizationId,
          id: In(warehouseIds),
        });
        if (count !== warehouseIds.length)
          throw new BadRequestException('Unknown warehouse for this workspace');
      }
      const repo = em.getRepository(UserWarehouseAssignment);
      await repo.delete({ userId, organizationId: scope.organizationId });
      await repo.save(
        warehouseIds.map((warehouseId) =>
          repo.create({ userId, warehouseId, organizationId: scope.organizationId }),
        ),
      );
      return { userId, warehouseIds, restricted: warehouseIds.length > 0 };
    });
  }
}
