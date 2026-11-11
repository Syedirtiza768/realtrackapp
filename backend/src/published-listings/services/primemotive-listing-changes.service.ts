import { createHmac } from 'node:crypto';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { StoreAccessService } from '../../channels/store-access.service.js';
import { SchedulerLeaderService } from '../../common/scheduler/scheduler-leader.service.js';
import { PublishedListingsQueryDto } from '../dto/published-listings.dto.js';
import { EbayPublishedListingChange } from '../entities/ebay-published-listing-change.entity.js';
import { PublishedListingsService } from './published-listings.service.js';

interface ClaimedChange {
  sequence: string;
  id: string;
  organization_id: string;
  store_id: string;
  listing_id: string;
  event_type: string;
  listing_snapshot: Record<string, unknown>;
  occurred_at: Date;
  delivery_attempts: number;
}

@Injectable()
export class PrimemotiveListingChangesService {
  private readonly logger = new Logger(PrimemotiveListingChangesService.name);
  private missingSecretWarned = false;

  constructor(
    @InjectRepository(EbayPublishedListingChange)
    private readonly changeRepo: Repository<EbayPublishedListingChange>,
    private readonly storeAccess: StoreAccessService,
    private readonly leader: SchedulerLeaderService,
    private readonly listings: PublishedListingsService,
  ) {}

  async listChanges(
    organizationId: string,
    user: User,
    query: PublishedListingsQueryDto,
  ) {
    await this.promoteCommittedChanges();
    if (query.afterSequence !== undefined) return this.listBySequence(organizationId, user, query);
    if (query.throughSequence !== undefined) throw new BadRequestException('throughSequence requires afterSequence');
    const updatedAfter = query.updatedAfter ?? query.updateAfter;
    if (!updatedAfter) {
      throw new BadRequestException(
        'updatedAfter is required when reading Primemotive changes',
      );
    }

    const storeId =
      await this.listings.resolvePrimemotiveStoreId(organizationId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const qb = this.changeRepo
      .createQueryBuilder('change')
      .where('change.organizationId = :organizationId', { organizationId })
      .andWhere('change.storeId = :storeId', { storeId })
      .andWhere('change.occurredAt >= :updatedAfter', { updatedAfter });

    if (!user.storeAccessAll) {
      const accessibleStores =
        await this.storeAccess.getAccessibleStoreIds(user);
      if (accessibleStores.size === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('change.storeId IN (:...storeIds)', {
          storeIds: [...accessibleStores],
        });
      }
    }

    const [items, total] = await qb
      .orderBy('change.occurredAt', 'ASC')
      .addOrderBy('change.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const nextUpdatedAfter = items.length
      ? items[items.length - 1].occurredAt.toISOString()
      : updatedAfter;

    return {
      items: items.map((change) => ({
        eventId: change.id,
        eventType: change.eventType,
        occurredAt: change.occurredAt.toISOString(),
        listingId: change.listingId,
        sequence: change.sequence,
        revision: change.listingSnapshot.revision ?? '0',
        listing: change.listingSnapshot,
      })),
      total,
      page,
      limit,
      nextUpdatedAfter,
    };
  }

  /** Assign a cursor only to already-committed rows. Serialized promoters commit in sequence order. */
  async promoteCommittedChanges() {
    await this.changeRepo.manager.transaction(async em => {
      const [{ locked }] = await em.query(`SELECT pg_try_advisory_xact_lock(hashtextextended('primemotive-change-promoter',0)) AS locked`);
      if (!locked) return;
      await em.query(`WITH due AS (SELECT id FROM ebay_published_listing_changes WHERE sequence IS NULL
        ORDER BY occurred_at,id LIMIT 5000 FOR UPDATE SKIP LOCKED)
        UPDATE ebay_published_listing_changes c SET sequence=nextval('primemotive_change_sequence') FROM due WHERE c.id=due.id`);
    });
  }

  private async listBySequence(organizationId: string, user: User, query: PublishedListingsQueryDto) {
    if (query.updatedAfter || query.updateAfter || (query.page ?? 1) !== 1) throw new BadRequestException('Sequence cursors cannot be combined with timestamp or offset pagination');
    const after = query.afterSequence!;
    for (const value of [after, query.throughSequence]) if (value && BigInt(value) > 9223372036854775807n) throw new BadRequestException('Sequence exceeds bigint range');
    const storeId = await this.listings.resolvePrimemotiveStoreId(organizationId);
    if (!user.storeAccessAll && !(await this.storeAccess.getAccessibleStoreIds(user)).has(storeId)) throw new BadRequestException('Primemotive store access is required');
    const [{ max }] = await this.changeRepo.manager.query(`SELECT GREATEST(COALESCE(max(sequence),0),$3::bigint)::text AS max FROM ebay_published_listing_changes WHERE organization_id=$1 AND store_id=$2`, [organizationId, storeId, after]);
    const through = query.throughSequence ?? max;
    if (BigInt(through) < BigInt(after) || BigInt(through) > BigInt(max)) throw new BadRequestException('Invalid sequence batch boundary');
    const limit = Math.min(query.limit ?? 50, 200);
    const params = [organizationId, storeId, after, through];
    const [{ total }] = await this.changeRepo.manager.query(`SELECT count(*)::int AS total FROM ebay_published_listing_changes WHERE organization_id=$1 AND store_id=$2 AND sequence>$3::bigint AND sequence<=$4::bigint`, params);
    const rows = await this.changeRepo.manager.query(`SELECT * FROM ebay_published_listing_changes WHERE organization_id=$1 AND store_id=$2 AND sequence>$3::bigint AND sequence<=$4::bigint ORDER BY sequence LIMIT $5`, [...params, limit]);
    return { items: rows.map((r: ClaimedChange) => ({ eventId: r.id, eventType: r.event_type, occurredAt: new Date(r.occurred_at).toISOString(),
      sequence: r.sequence, revision: r.listing_snapshot.revision ?? '0', listingId: r.listing_id, listing: r.listing_snapshot })),
      total, limit, nextSequence: rows.at(-1)?.sequence ?? after, throughSequence: through, hasMore: total > rows.length };
  }

  /** Delivers the durable change outbox as signed, retryable webhooks. */
  @Cron('*/15 * * * * *', { name: 'primemotive-listing-webhooks' })
  async dispatchWebhooks(): Promise<void> {
    await this.promoteCommittedChanges();
    const endpoint = process.env.PRIMEMOTIVE_LISTING_WEBHOOK_URL?.trim();
    const secret = process.env.PRIMEMOTIVE_LISTING_WEBHOOK_SECRET?.trim();
    if (!endpoint) return;
    const organizationId = process.env.PRIMEMOTIVE_LISTING_WEBHOOK_ORGANIZATION_ID?.trim();
    if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
      this.logger.error('Outbound listing delivery requires a valid PRIMEMOTIVE_LISTING_WEBHOOK_ORGANIZATION_ID');
      return;
    }
    const storeId = await this.listings.resolvePrimemotiveStoreId(organizationId);
    if (!secret) {
      if (!this.missingSecretWarned) {
        this.logger.warn(
          'Primemotive listing webhook URL is configured without a signing secret; delivery is paused',
        );
        this.missingSecretWarned = true;
      }
      return;
    }

    let parsedEndpoint: URL;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      this.logger.error('PRIMEMOTIVE_LISTING_WEBHOOK_URL is not a valid URL');
      return;
    }
    if (parsedEndpoint.username || parsedEndpoint.password) {
      this.logger.error(
        'Primemotive listing webhook URL must not contain embedded credentials',
      );
      return;
    }
    if (
      parsedEndpoint.protocol !== 'https:' &&
      !(
        process.env.NODE_ENV !== 'production' &&
        parsedEndpoint.protocol === 'http:'
      )
    ) {
      this.logger.error('Primemotive listing webhook endpoint must use HTTPS');
      return;
    }

    await this.leader.runIfLeader(
      'primemotive-listing-webhooks',
      60,
      async () => this.deliverDueChanges(parsedEndpoint.toString(), secret, organizationId, storeId),
    );
  }

  private async deliverDueChanges(endpoint: string, secret: string, organizationId: string, storeId: string) {
    const claimed = await this.claimDueChanges(organizationId, storeId);
    for (let index = 0; index < claimed.length; index += 10) {
      await Promise.all(
        claimed
          .slice(index, index + 10)
          .map((change) => this.deliverOne(endpoint, secret, change)),
      );
    }
  }

  private async claimDueChanges(organizationId: string, storeId: string): Promise<ClaimedChange[]> {
    const queryRunner = this.changeRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const rows = (await queryRunner.query(`
        SELECT c.id, c.organization_id, c.store_id, c.listing_id, c.event_type,
               c.listing_snapshot, c.occurred_at, c.delivery_attempts,c.sequence
        FROM "ebay_published_listing_changes" c
        WHERE c.organization_id=$1 AND c.store_id=$2 AND c.sequence IS NOT NULL
          AND c.delivered_at IS NULL AND c.next_attempt_at <= clock_timestamp()
          AND NOT EXISTS(SELECT 1 FROM ebay_published_listing_changes older WHERE older.organization_id=c.organization_id
            AND older.store_id=c.store_id AND older.listing_id=c.listing_id AND older.sequence<c.sequence AND older.delivered_at IS NULL)
        ORDER BY c.sequence
        LIMIT 50
        FOR UPDATE OF c SKIP LOCKED
      `, [organizationId, storeId])) as ClaimedChange[];
      for (const row of rows) {
        await queryRunner.query(
          `UPDATE "ebay_published_listing_changes"
           SET "delivery_attempts" = "delivery_attempts" + 1,
               "next_attempt_at" = clock_timestamp() + INTERVAL '2 minutes'
           WHERE "id" = $1`,
          [row.id],
        );
        row.delivery_attempts += 1;
      }
      await queryRunner.commitTransaction();
      return rows;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async deliverOne(
    endpoint: string,
    secret: string,
    change: ClaimedChange,
  ): Promise<void> {
    const occurredAt = new Date(change.occurred_at).toISOString();
    const body = JSON.stringify({
      eventId: change.id,
      sequence: change.sequence,
      revision: change.listing_snapshot.revision ?? '0',
      eventType: change.event_type,
      occurredAt,
      organizationId: change.organization_id,
      storeId: change.store_id,
      listingId: change.listing_id,
      listing: change.listing_snapshot,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    try {
      await axios.post(endpoint, body, {
        timeout: 10000,
        maxRedirects: 0,
        headers: {
          'Content-Type': 'application/json',
          'X-Primemotive-Timestamp': timestamp,
          'X-Primemotive-Signature': `sha256=${signature}`,
          'X-Primemotive-Event-Id': change.id,
        },
      });
      await this.changeRepo.update(change.id, {
        deliveredAt: new Date(),
        lastDeliveryError: null,
      });
    } catch (error) {
      const retrySeconds = Math.min(
        3600,
        15 * 2 ** Math.min(change.delivery_attempts - 1, 8),
      );
      const message = error instanceof Error ? error.message : String(error);
      await this.changeRepo.update(change.id, {
        nextAttemptAt: new Date(Date.now() + retrySeconds * 1000),
        lastDeliveryError: message.slice(0, 2000),
      });
      this.logger.warn(
        `Primemotive webhook delivery failed for event ${change.id}; retrying in ${retrySeconds}s: ${message}`,
      );
    }
  }
}
