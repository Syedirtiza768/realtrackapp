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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PrimemotiveListingChangesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimemotiveListingChangesService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = __importDefault(require("axios"));
const typeorm_2 = require("typeorm");
const store_access_service_js_1 = require("../../channels/store-access.service.js");
const scheduler_leader_service_js_1 = require("../../common/scheduler/scheduler-leader.service.js");
const ebay_published_listing_change_entity_js_1 = require("../entities/ebay-published-listing-change.entity.js");
const published_listings_service_js_1 = require("./published-listings.service.js");
let PrimemotiveListingChangesService = PrimemotiveListingChangesService_1 = class PrimemotiveListingChangesService {
    changeRepo;
    storeAccess;
    leader;
    listings;
    logger = new common_1.Logger(PrimemotiveListingChangesService_1.name);
    missingSecretWarned = false;
    constructor(changeRepo, storeAccess, leader, listings) {
        this.changeRepo = changeRepo;
        this.storeAccess = storeAccess;
        this.leader = leader;
        this.listings = listings;
    }
    async listChanges(organizationId, user, query) {
        await this.promoteCommittedChanges();
        if (query.afterSequence !== undefined)
            return this.listBySequence(organizationId, user, query);
        if (query.throughSequence !== undefined)
            throw new common_1.BadRequestException('throughSequence requires afterSequence');
        const updatedAfter = query.updatedAfter ?? query.updateAfter;
        if (!updatedAfter) {
            throw new common_1.BadRequestException('updatedAfter is required when reading Primemotive changes');
        }
        const storeId = await this.listings.resolvePrimemotiveStoreId(organizationId);
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 50, 200);
        const qb = this.changeRepo
            .createQueryBuilder('change')
            .where('change.organizationId = :organizationId', { organizationId })
            .andWhere('change.storeId = :storeId', { storeId })
            .andWhere('change.occurredAt >= :updatedAfter', { updatedAfter });
        if (!user.storeAccessAll) {
            const accessibleStores = await this.storeAccess.getAccessibleStoreIds(user);
            if (accessibleStores.size === 0) {
                qb.andWhere('1 = 0');
            }
            else {
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
    async promoteCommittedChanges() {
        await this.changeRepo.manager.transaction(async (em) => {
            const [{ locked }] = await em.query(`SELECT pg_try_advisory_xact_lock(hashtextextended('primemotive-change-promoter',0)) AS locked`);
            if (!locked)
                return;
            await em.query(`WITH due AS (SELECT id FROM ebay_published_listing_changes WHERE sequence IS NULL
        ORDER BY occurred_at,id LIMIT 5000 FOR UPDATE SKIP LOCKED)
        UPDATE ebay_published_listing_changes c SET sequence=nextval('primemotive_change_sequence') FROM due WHERE c.id=due.id`);
        });
    }
    async listBySequence(organizationId, user, query) {
        if (query.updatedAfter || query.updateAfter || (query.page ?? 1) !== 1)
            throw new common_1.BadRequestException('Sequence cursors cannot be combined with timestamp or offset pagination');
        const after = query.afterSequence;
        for (const value of [after, query.throughSequence])
            if (value && BigInt(value) > 9223372036854775807n)
                throw new common_1.BadRequestException('Sequence exceeds bigint range');
        const storeId = await this.listings.resolvePrimemotiveStoreId(organizationId);
        if (!user.storeAccessAll && !(await this.storeAccess.getAccessibleStoreIds(user)).has(storeId))
            throw new common_1.BadRequestException('Primemotive store access is required');
        const [{ max }] = await this.changeRepo.manager.query(`SELECT GREATEST(COALESCE(max(sequence),0),$3::bigint)::text AS max FROM ebay_published_listing_changes WHERE organization_id=$1 AND store_id=$2`, [organizationId, storeId, after]);
        const through = query.throughSequence ?? max;
        if (BigInt(through) < BigInt(after) || BigInt(through) > BigInt(max))
            throw new common_1.BadRequestException('Invalid sequence batch boundary');
        const limit = Math.min(query.limit ?? 50, 200);
        const params = [organizationId, storeId, after, through];
        const [{ total }] = await this.changeRepo.manager.query(`SELECT count(*)::int AS total FROM ebay_published_listing_changes WHERE organization_id=$1 AND store_id=$2 AND sequence>$3::bigint AND sequence<=$4::bigint`, params);
        const rows = await this.changeRepo.manager.query(`SELECT * FROM ebay_published_listing_changes WHERE organization_id=$1 AND store_id=$2 AND sequence>$3::bigint AND sequence<=$4::bigint ORDER BY sequence LIMIT $5`, [...params, limit]);
        return { items: rows.map((r) => ({ eventId: r.id, eventType: r.event_type, occurredAt: new Date(r.occurred_at).toISOString(),
                sequence: r.sequence, revision: r.listing_snapshot.revision ?? '0', listingId: r.listing_id, listing: r.listing_snapshot })),
            total, limit, nextSequence: rows.at(-1)?.sequence ?? after, throughSequence: through, hasMore: total > rows.length };
    }
    async dispatchWebhooks() {
        await this.promoteCommittedChanges();
        const endpoint = process.env.PRIMEMOTIVE_LISTING_WEBHOOK_URL?.trim();
        const secret = process.env.PRIMEMOTIVE_LISTING_WEBHOOK_SECRET?.trim();
        if (!endpoint)
            return;
        const organizationId = process.env.PRIMEMOTIVE_LISTING_WEBHOOK_ORGANIZATION_ID?.trim();
        if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
            this.logger.error('Outbound listing delivery requires a valid PRIMEMOTIVE_LISTING_WEBHOOK_ORGANIZATION_ID');
            return;
        }
        const storeId = await this.listings.resolvePrimemotiveStoreId(organizationId);
        if (!secret) {
            if (!this.missingSecretWarned) {
                this.logger.warn('Primemotive listing webhook URL is configured without a signing secret; delivery is paused');
                this.missingSecretWarned = true;
            }
            return;
        }
        let parsedEndpoint;
        try {
            parsedEndpoint = new URL(endpoint);
        }
        catch {
            this.logger.error('PRIMEMOTIVE_LISTING_WEBHOOK_URL is not a valid URL');
            return;
        }
        if (parsedEndpoint.username || parsedEndpoint.password) {
            this.logger.error('Primemotive listing webhook URL must not contain embedded credentials');
            return;
        }
        if (parsedEndpoint.protocol !== 'https:' &&
            !(process.env.NODE_ENV !== 'production' &&
                parsedEndpoint.protocol === 'http:')) {
            this.logger.error('Primemotive listing webhook endpoint must use HTTPS');
            return;
        }
        await this.leader.runIfLeader('primemotive-listing-webhooks', 60, async () => this.deliverDueChanges(parsedEndpoint.toString(), secret, organizationId, storeId));
    }
    async deliverDueChanges(endpoint, secret, organizationId, storeId) {
        const claimed = await this.claimDueChanges(organizationId, storeId);
        for (let index = 0; index < claimed.length; index += 10) {
            await Promise.all(claimed
                .slice(index, index + 10)
                .map((change) => this.deliverOne(endpoint, secret, change)));
        }
    }
    async claimDueChanges(organizationId, storeId) {
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
      `, [organizationId, storeId]));
            for (const row of rows) {
                await queryRunner.query(`UPDATE "ebay_published_listing_changes"
           SET "delivery_attempts" = "delivery_attempts" + 1,
               "next_attempt_at" = clock_timestamp() + INTERVAL '2 minutes'
           WHERE "id" = $1`, [row.id]);
                row.delivery_attempts += 1;
            }
            await queryRunner.commitTransaction();
            return rows;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async deliverOne(endpoint, secret, change) {
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
        const signature = (0, node_crypto_1.createHmac)('sha256', secret)
            .update(`${timestamp}.${body}`)
            .digest('hex');
        try {
            await axios_1.default.post(endpoint, body, {
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
        }
        catch (error) {
            const retrySeconds = Math.min(3600, 15 * 2 ** Math.min(change.delivery_attempts - 1, 8));
            const message = error instanceof Error ? error.message : String(error);
            await this.changeRepo.update(change.id, {
                nextAttemptAt: new Date(Date.now() + retrySeconds * 1000),
                lastDeliveryError: message.slice(0, 2000),
            });
            this.logger.warn(`Primemotive webhook delivery failed for event ${change.id}; retrying in ${retrySeconds}s: ${message}`);
        }
    }
};
exports.PrimemotiveListingChangesService = PrimemotiveListingChangesService;
__decorate([
    (0, schedule_1.Cron)('*/15 * * * * *', { name: 'primemotive-listing-webhooks' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PrimemotiveListingChangesService.prototype, "dispatchWebhooks", null);
exports.PrimemotiveListingChangesService = PrimemotiveListingChangesService = PrimemotiveListingChangesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_change_entity_js_1.EbayPublishedListingChange)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        store_access_service_js_1.StoreAccessService,
        scheduler_leader_service_js_1.SchedulerLeaderService,
        published_listings_service_js_1.PublishedListingsService])
], PrimemotiveListingChangesService);
//# sourceMappingURL=primemotive-listing-changes.service.js.map