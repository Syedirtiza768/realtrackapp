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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var InventoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const inventory_ledger_entity_js_1 = require("./entities/inventory-ledger.entity.js");
const inventory_event_entity_js_1 = require("./entities/inventory-event.entity.js");
const store_inventory_allocation_entity_js_1 = require("./entities/store-inventory-allocation.entity.js");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
let InventoryService = InventoryService_1 = class InventoryService {
    ledgerRepo;
    eventRepo;
    allocationRepo;
    dataSource;
    featureFlags;
    logger = new common_1.Logger(InventoryService_1.name);
    constructor(ledgerRepo, eventRepo, allocationRepo, dataSource, featureFlags) {
        this.ledgerRepo = ledgerRepo;
        this.eventRepo = eventRepo;
        this.allocationRepo = allocationRepo;
        this.dataSource = dataSource;
        this.featureFlags = featureFlags;
    }
    async getLedger(listingId) {
        let ledger = await this.ledgerRepo.findOneBy({ listingId });
        if (!ledger) {
            ledger = await this.ledgerRepo.save(this.ledgerRepo.create({
                listingId,
                quantityTotal: 0,
                quantityReserved: 0,
            }));
        }
        const recentEvents = await this.eventRepo.find({
            where: { listingId },
            order: { createdAt: 'DESC' },
            take: 20,
        });
        return { ledger, recentEvents };
    }
    async getLowStock(threshold, limit) {
        const qb = this.ledgerRepo
            .createQueryBuilder('l')
            .where('l.quantity_total - l.quantity_reserved <= :threshold', {
            threshold: threshold ?? 5,
        })
            .orderBy('l.quantity_total - l.quantity_reserved', 'ASC')
            .take(limit ?? 50);
        return qb.getMany();
    }
    async getEvents(listingId, type, since, limit = 50, offset = 0) {
        const qb = this.eventRepo.createQueryBuilder('e');
        if (listingId) {
            qb.andWhere('e.listing_id = :listingId', { listingId });
        }
        if (type) {
            qb.andWhere('e.event_type = :type', { type });
        }
        if (since) {
            qb.andWhere('e.created_at >= :since', { since: new Date(since) });
        }
        qb.orderBy('e.created_at', 'DESC').take(limit).skip(offset);
        const [events, total] = await qb.getManyAndCount();
        return { events, total };
    }
    async adjustQuantity(listingId, change, reason, idempotencyKey, sourceChannel) {
        return this.dataSource.transaction('SERIALIZABLE', async (em) => {
            const existing = await em.findOne(inventory_event_entity_js_1.InventoryEvent, {
                where: { idempotencyKey },
            });
            if (existing) {
                const ledger = await em.findOneByOrFail(inventory_ledger_entity_js_1.InventoryLedger, { listingId });
                return { ledger, event: existing };
            }
            let ledger = await em
                .createQueryBuilder(inventory_ledger_entity_js_1.InventoryLedger, 'l')
                .setLock('pessimistic_write')
                .where('l.listing_id = :listingId', { listingId })
                .getOne();
            if (!ledger) {
                ledger = em.create(inventory_ledger_entity_js_1.InventoryLedger, {
                    listingId,
                    quantityTotal: 0,
                    quantityReserved: 0,
                });
                ledger = await em.save(inventory_ledger_entity_js_1.InventoryLedger, ledger);
                ledger = await em
                    .createQueryBuilder(inventory_ledger_entity_js_1.InventoryLedger, 'l')
                    .setLock('pessimistic_write')
                    .where('l.listing_id = :listingId', { listingId })
                    .getOneOrFail();
            }
            const newTotal = ledger.quantityTotal + change;
            if (newTotal < 0) {
                throw new common_1.BadRequestException('Insufficient stock');
            }
            if (newTotal < ledger.quantityReserved) {
                throw new common_1.BadRequestException('Cannot reduce below reserved quantity');
            }
            const event = em.create(inventory_event_entity_js_1.InventoryEvent, {
                listingId,
                eventType: 'manual_adjust',
                quantityChange: change,
                quantityBefore: ledger.quantityTotal,
                quantityAfter: newTotal,
                sourceChannel: sourceChannel ?? 'manual',
                idempotencyKey,
                reason,
            });
            await em.save(inventory_event_entity_js_1.InventoryEvent, event);
            ledger.quantityTotal = newTotal;
            await em.save(inventory_ledger_entity_js_1.InventoryLedger, ledger);
            this.logger.log(`Adjusted inventory for ${listingId}: ${change > 0 ? '+' : ''}${change} → ${newTotal}`);
            return { ledger, event };
        });
    }
    async reserveQuantity(listingId, quantity, orderId) {
        if (quantity <= 0)
            throw new common_1.BadRequestException('Reserve quantity must be positive');
        return this.dataSource.transaction('SERIALIZABLE', async (em) => {
            const idempotencyKey = `reserve:${orderId}:${listingId}`;
            const existing = await em.findOne(inventory_event_entity_js_1.InventoryEvent, {
                where: { idempotencyKey },
            });
            if (existing) {
                const ledger = await em.findOneByOrFail(inventory_ledger_entity_js_1.InventoryLedger, { listingId });
                return { ledger, event: existing };
            }
            const ledger = await em
                .createQueryBuilder(inventory_ledger_entity_js_1.InventoryLedger, 'l')
                .setLock('pessimistic_write')
                .where('l.listing_id = :listingId', { listingId })
                .getOneOrFail();
            const available = ledger.quantityTotal - ledger.quantityReserved;
            if (quantity > available) {
                throw new common_1.BadRequestException(`Insufficient available stock: requested ${quantity}, available ${available}`);
            }
            const event = em.create(inventory_event_entity_js_1.InventoryEvent, {
                listingId,
                eventType: 'reserve',
                quantityChange: -quantity,
                quantityBefore: available,
                quantityAfter: available - quantity,
                sourceOrderId: orderId,
                sourceChannel: 'system',
                idempotencyKey,
                reason: `Reserved for order ${orderId}`,
            });
            await em.save(inventory_event_entity_js_1.InventoryEvent, event);
            ledger.quantityReserved += quantity;
            await em.save(inventory_ledger_entity_js_1.InventoryLedger, ledger);
            return { ledger, event };
        });
    }
    async releaseReservation(listingId, quantity, orderId) {
        if (quantity <= 0)
            throw new common_1.BadRequestException('Release quantity must be positive');
        return this.dataSource.transaction('SERIALIZABLE', async (em) => {
            const idempotencyKey = `release:${orderId}:${listingId}`;
            const existing = await em.findOne(inventory_event_entity_js_1.InventoryEvent, {
                where: { idempotencyKey },
            });
            if (existing) {
                const ledger = await em.findOneByOrFail(inventory_ledger_entity_js_1.InventoryLedger, { listingId });
                return { ledger, event: existing };
            }
            const ledger = await em
                .createQueryBuilder(inventory_ledger_entity_js_1.InventoryLedger, 'l')
                .setLock('pessimistic_write')
                .where('l.listing_id = :listingId', { listingId })
                .getOneOrFail();
            if (quantity > ledger.quantityReserved) {
                throw new common_1.BadRequestException('Release quantity exceeds reserved amount');
            }
            const event = em.create(inventory_event_entity_js_1.InventoryEvent, {
                listingId,
                eventType: 'release_reserve',
                quantityChange: quantity,
                quantityBefore: ledger.quantityTotal - ledger.quantityReserved,
                quantityAfter: ledger.quantityTotal - (ledger.quantityReserved - quantity),
                sourceOrderId: orderId,
                sourceChannel: 'system',
                idempotencyKey,
                reason: `Released reservation for order ${orderId}`,
            });
            await em.save(inventory_event_entity_js_1.InventoryEvent, event);
            ledger.quantityReserved -= quantity;
            await em.save(inventory_ledger_entity_js_1.InventoryLedger, ledger);
            return { ledger, event };
        });
    }
    async reconcile(listingIds) {
        const results = [];
        for (const listingId of listingIds) {
            try {
                const sumResult = await this.eventRepo
                    .createQueryBuilder('e')
                    .select('COALESCE(SUM(e.quantity_change), 0)', 'total')
                    .where('e.listing_id = :listingId', { listingId })
                    .andWhere('e.event_type != :reserve', { reserve: 'reserve' })
                    .andWhere('e.event_type != :release', { release: 'release_reserve' })
                    .getRawOne();
                const expectedTotal = parseInt(sumResult?.total ?? '0', 10);
                const ledger = await this.ledgerRepo.findOneBy({ listingId });
                if (!ledger) {
                    results.push({ listingId, status: 'no_ledger' });
                    continue;
                }
                const diff = expectedTotal - ledger.quantityTotal;
                if (diff === 0) {
                    ledger.lastReconciledAt = new Date();
                    await this.ledgerRepo.save(ledger);
                    results.push({ listingId, status: 'ok' });
                }
                else {
                    await this.adjustQuantity(listingId, diff, `Reconciliation correction: ${diff > 0 ? '+' : ''}${diff}`, `reconcile:${listingId}:${Date.now()}`, 'system');
                    results.push({ listingId, status: 'corrected', diff });
                }
            }
            catch (error) {
                results.push({ listingId, status: `error: ${error.message}` });
            }
        }
        return { results };
    }
    async findDuplicates(confidence = 0.8) {
        const query = `
      SELECT a.id AS "idA", b.id AS "idB",
             similarity(a.title, b.title) AS title_sim,
             CASE WHEN a.custom_label_sku = b.custom_label_sku AND a.custom_label_sku IS NOT NULL
                  THEN 1.0 ELSE 0 END AS sku_match,
             CASE WHEN a.c_manufacturer_part_number = b.c_manufacturer_part_number
                  AND a.c_brand = b.c_brand
                  AND a.c_manufacturer_part_number IS NOT NULL
                  THEN 0.95 ELSE 0 END AS mpn_match
      FROM listing_records a
      JOIN listing_records b ON a.id < b.id
        AND a.deleted_at IS NULL AND b.deleted_at IS NULL
      WHERE similarity(a.title, b.title) > $1
         OR (a.custom_label_sku = b.custom_label_sku AND a.custom_label_sku IS NOT NULL)
         OR (a.c_manufacturer_part_number = b.c_manufacturer_part_number
             AND a.c_brand = b.c_brand
             AND a.c_manufacturer_part_number IS NOT NULL)
      ORDER BY GREATEST(similarity(a.title, b.title),
                        CASE WHEN a.custom_label_sku = b.custom_label_sku AND a.custom_label_sku IS NOT NULL THEN 1.0 ELSE 0 END,
                        CASE WHEN a.c_manufacturer_part_number = b.c_manufacturer_part_number AND a.c_brand = b.c_brand AND a.c_manufacturer_part_number IS NOT NULL THEN 0.95 ELSE 0 END
                       ) DESC
      LIMIT 100
    `;
        const rows = await this.dataSource.query(query, [confidence]);
        return rows.map((r) => {
            let matchType = 'title';
            let score = parseFloat(r.title_sim);
            if (parseFloat(r.sku_match) === 1.0) {
                matchType = 'sku';
                score = 1.0;
            }
            else if (parseFloat(r.mpn_match) === 0.95) {
                matchType = 'mpn';
                score = 0.95;
            }
            return { idA: r.idA, idB: r.idB, matchType, score };
        });
    }
    async getAllocations(listingId, storeId) {
        const where = { listingId };
        if (storeId)
            where['storeId'] = storeId;
        return this.allocationRepo.find({ where, order: { updatedAt: 'DESC' } });
    }
    async allocateToStore(listingId, storeId, quantity) {
        const perStoreEnabled = await this.featureFlags.isEnabled('per_store_inventory');
        if (!perStoreEnabled) {
            throw new common_1.BadRequestException('Per-store inventory is not enabled');
        }
        if (quantity < 0)
            throw new common_1.BadRequestException('Allocation quantity must be >= 0');
        return this.dataSource.transaction('SERIALIZABLE', async (em) => {
            const ledger = await em
                .createQueryBuilder(inventory_ledger_entity_js_1.InventoryLedger, 'l')
                .setLock('pessimistic_write')
                .where('l.listing_id = :listingId', { listingId })
                .getOne();
            if (!ledger) {
                throw new common_1.NotFoundException(`No inventory ledger for listing ${listingId}`);
            }
            const { total: currentAllocated } = (await em
                .createQueryBuilder(store_inventory_allocation_entity_js_1.StoreInventoryAllocation, 'a')
                .select('COALESCE(SUM(a.allocated_qty), 0)', 'total')
                .where('a.listing_id = :listingId', { listingId })
                .andWhere('a.store_id != :storeId', { storeId })
                .getRawOne());
            const existing = await em.findOne(store_inventory_allocation_entity_js_1.StoreInventoryAllocation, {
                where: { listingId, storeId },
            });
            const otherAllocated = parseInt(currentAllocated, 10);
            const totalAvailable = ledger.quantityTotal - ledger.quantityReserved;
            if (otherAllocated + quantity > totalAvailable) {
                throw new common_1.BadRequestException(`Cannot allocate ${quantity} — only ${totalAvailable - otherAllocated} available (pool: ${totalAvailable}, other stores: ${otherAllocated})`);
            }
            if (existing) {
                existing.allocatedQty = quantity;
                return em.save(store_inventory_allocation_entity_js_1.StoreInventoryAllocation, existing);
            }
            const allocation = em.create(store_inventory_allocation_entity_js_1.StoreInventoryAllocation, {
                listingId,
                storeId,
                allocatedQty: quantity,
                reservedQty: 0,
            });
            return em.save(store_inventory_allocation_entity_js_1.StoreInventoryAllocation, allocation);
        });
    }
    async reserveFromStore(listingId, storeId, quantity, orderId) {
        const perStoreEnabled = await this.featureFlags.isEnabled('per_store_inventory');
        if (!perStoreEnabled) {
            throw new common_1.BadRequestException('Per-store inventory is not enabled');
        }
        if (quantity <= 0)
            throw new common_1.BadRequestException('Reserve quantity must be positive');
        return this.dataSource.transaction('SERIALIZABLE', async (em) => {
            const allocation = await em
                .createQueryBuilder(store_inventory_allocation_entity_js_1.StoreInventoryAllocation, 'a')
                .setLock('pessimistic_write')
                .where('a.listing_id = :listingId AND a.store_id = :storeId', {
                listingId,
                storeId,
            })
                .getOne();
            if (!allocation) {
                throw new common_1.NotFoundException(`No allocation for listing ${listingId} at store ${storeId}`);
            }
            const available = allocation.allocatedQty - allocation.reservedQty;
            if (quantity > available) {
                throw new common_1.BadRequestException(`Insufficient store allocation: requested ${quantity}, available ${available}`);
            }
            allocation.reservedQty += quantity;
            return em.save(store_inventory_allocation_entity_js_1.StoreInventoryAllocation, allocation);
        });
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = InventoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(inventory_ledger_entity_js_1.InventoryLedger)),
    __param(1, (0, typeorm_1.InjectRepository)(inventory_event_entity_js_1.InventoryEvent)),
    __param(2, (0, typeorm_1.InjectRepository)(store_inventory_allocation_entity_js_1.StoreInventoryAllocation)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        feature_flag_service_js_1.FeatureFlagService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map