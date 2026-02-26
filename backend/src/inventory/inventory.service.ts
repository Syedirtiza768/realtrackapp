import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { InventoryLedger } from './entities/inventory-ledger.entity.js';
import { InventoryEvent } from './entities/inventory-event.entity.js';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryLedger)
    private readonly ledgerRepo: Repository<InventoryLedger>,
    @InjectRepository(InventoryEvent)
    private readonly eventRepo: Repository<InventoryEvent>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Read ───

  async getLedger(listingId: string): Promise<{
    ledger: InventoryLedger;
    recentEvents: InventoryEvent[];
  }> {
    let ledger = await this.ledgerRepo.findOneBy({ listingId });
    if (!ledger) {
      // Auto-create ledger on first access
      ledger = await this.ledgerRepo.save(
        this.ledgerRepo.create({ listingId, quantityTotal: 0, quantityReserved: 0 }),
      );
    }

    const recentEvents = await this.eventRepo.find({
      where: { listingId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return { ledger, recentEvents };
  }

  async getLowStock(
    threshold?: number,
    limit?: number,
  ): Promise<InventoryLedger[]> {
    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .where('l.quantity_total - l.quantity_reserved <= :threshold', {
        threshold: threshold ?? 5,
      })
      .orderBy('l.quantity_total - l.quantity_reserved', 'ASC')
      .take(limit ?? 50);

    return qb.getMany();
  }

  async getEvents(
    listingId?: string,
    type?: string,
    since?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ events: InventoryEvent[]; total: number }> {
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

  // ─── Mutations (SERIALIZABLE transactions) ───

  async adjustQuantity(
    listingId: string,
    change: number,
    reason: string,
    idempotencyKey: string,
    sourceChannel?: string,
  ): Promise<{ ledger: InventoryLedger; event: InventoryEvent }> {
    return this.dataSource.transaction('SERIALIZABLE', async (em) => {
      // 1. Idempotency check
      const existing = await em.findOne(InventoryEvent, {
        where: { idempotencyKey },
      });
      if (existing) {
        const ledger = await em.findOneByOrFail(InventoryLedger, { listingId });
        return { ledger, event: existing };
      }

      // 2. Lock ledger row
      let ledger = await em
        .createQueryBuilder(InventoryLedger, 'l')
        .setLock('pessimistic_write')
        .where('l.listing_id = :listingId', { listingId })
        .getOne();

      if (!ledger) {
        ledger = em.create(InventoryLedger, {
          listingId,
          quantityTotal: 0,
          quantityReserved: 0,
        });
        ledger = await em.save(InventoryLedger, ledger);
        // Re-lock
        ledger = await em
          .createQueryBuilder(InventoryLedger, 'l')
          .setLock('pessimistic_write')
          .where('l.listing_id = :listingId', { listingId })
          .getOneOrFail();
      }

      // 3. Validate
      const newTotal = ledger.quantityTotal + change;
      if (newTotal < 0) {
        throw new BadRequestException('Insufficient stock');
      }
      if (newTotal < ledger.quantityReserved) {
        throw new BadRequestException('Cannot reduce below reserved quantity');
      }

      // 4. Create event
      const event = em.create(InventoryEvent, {
        listingId,
        eventType: 'manual_adjust',
        quantityChange: change,
        quantityBefore: ledger.quantityTotal,
        quantityAfter: newTotal,
        sourceChannel: sourceChannel ?? 'manual',
        idempotencyKey,
        reason,
      });
      await em.save(InventoryEvent, event);

      // 5. Update ledger
      ledger.quantityTotal = newTotal;
      await em.save(InventoryLedger, ledger);

      this.logger.log(
        `Adjusted inventory for ${listingId}: ${change > 0 ? '+' : ''}${change} → ${newTotal}`,
      );
      return { ledger, event };
    });
  }

  async reserveQuantity(
    listingId: string,
    quantity: number,
    orderId: string,
  ): Promise<{ ledger: InventoryLedger; event: InventoryEvent }> {
    if (quantity <= 0) throw new BadRequestException('Reserve quantity must be positive');

    return this.dataSource.transaction('SERIALIZABLE', async (em) => {
      const idempotencyKey = `reserve:${orderId}:${listingId}`;
      const existing = await em.findOne(InventoryEvent, { where: { idempotencyKey } });
      if (existing) {
        const ledger = await em.findOneByOrFail(InventoryLedger, { listingId });
        return { ledger, event: existing };
      }

      const ledger = await em
        .createQueryBuilder(InventoryLedger, 'l')
        .setLock('pessimistic_write')
        .where('l.listing_id = :listingId', { listingId })
        .getOneOrFail();

      const available = ledger.quantityTotal - ledger.quantityReserved;
      if (quantity > available) {
        throw new BadRequestException(
          `Insufficient available stock: requested ${quantity}, available ${available}`,
        );
      }

      const event = em.create(InventoryEvent, {
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
      await em.save(InventoryEvent, event);

      ledger.quantityReserved += quantity;
      await em.save(InventoryLedger, ledger);

      return { ledger, event };
    });
  }

  async releaseReservation(
    listingId: string,
    quantity: number,
    orderId: string,
  ): Promise<{ ledger: InventoryLedger; event: InventoryEvent }> {
    if (quantity <= 0) throw new BadRequestException('Release quantity must be positive');

    return this.dataSource.transaction('SERIALIZABLE', async (em) => {
      const idempotencyKey = `release:${orderId}:${listingId}`;
      const existing = await em.findOne(InventoryEvent, { where: { idempotencyKey } });
      if (existing) {
        const ledger = await em.findOneByOrFail(InventoryLedger, { listingId });
        return { ledger, event: existing };
      }

      const ledger = await em
        .createQueryBuilder(InventoryLedger, 'l')
        .setLock('pessimistic_write')
        .where('l.listing_id = :listingId', { listingId })
        .getOneOrFail();

      if (quantity > ledger.quantityReserved) {
        throw new BadRequestException('Release quantity exceeds reserved amount');
      }

      const event = em.create(InventoryEvent, {
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
      await em.save(InventoryEvent, event);

      ledger.quantityReserved -= quantity;
      await em.save(InventoryLedger, ledger);

      return { ledger, event };
    });
  }

  // ─── Reconciliation ───

  async reconcile(
    listingIds: string[],
  ): Promise<{ results: Array<{ listingId: string; status: string; diff?: number }> }> {
    const results: Array<{ listingId: string; status: string; diff?: number }> = [];

    for (const listingId of listingIds) {
      try {
        // Compute expected quantity from event log
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
        } else {
          // Apply correction
          await this.adjustQuantity(
            listingId,
            diff,
            `Reconciliation correction: ${diff > 0 ? '+' : ''}${diff}`,
            `reconcile:${listingId}:${Date.now()}`,
            'system',
          );
          results.push({ listingId, status: 'corrected', diff });
        }
      } catch (error: any) {
        results.push({ listingId, status: `error: ${error.message}` });
      }
    }

    return { results };
  }

  // ─── Duplicate detection ───

  async findDuplicates(confidence = 0.8): Promise<Array<{
    idA: string;
    idB: string;
    matchType: string;
    score: number;
  }>> {
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
    return rows.map((r: any) => {
      let matchType = 'title';
      let score = parseFloat(r.title_sim);
      if (parseFloat(r.sku_match) === 1.0) {
        matchType = 'sku';
        score = 1.0;
      } else if (parseFloat(r.mpn_match) === 0.95) {
        matchType = 'mpn';
        score = 0.95;
      }
      return { idA: r.idA, idB: r.idB, matchType, score };
    });
  }
}
