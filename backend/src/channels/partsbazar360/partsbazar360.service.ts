import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, UnrecoverableError } from 'bullmq';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { ChannelConnection } from '../entities/channel-connection.entity.js';
import { ListingChannelInstance } from '../entities/listing-channel-instance.entity.js';
import { Store } from '../entities/store.entity.js';
import { StorageService } from '../../storage/storage.service.js';
import { TokenEncryptionService } from '../token-encryption.service.js';
import {
  PartsBazar360Client,
  PartsBazarApiError,
} from './partsbazar360.client.js';
import {
  buildPartsBazarPushItem,
  storedImageUrls,
} from './partsbazar360-listing.mapper.js';
import {
  PARTSBAZAR360_CHANNEL,
  type PartsBazarPushItemResult,
  type PartsBazarStatusResponse,
} from './partsbazar360.types.js';

export const PARTSBAZAR360_STATUS_JOB = 'partsbazar-status-check';
const MAX_STATUS_CHECKS = 6;

const OUTCOME_MESSAGES: Record<string, string> = {
  skipped_non_english_title: 'the title is not in English',
  skipped_inactive_or_zero_stock: 'the listing is inactive or has no stock',
  skipped_wrong_marketplace: 'the listing is not on the US Motors marketplace',
  skipped_ebay_mag: 'the listing uses eBay Mag images',
  skipped_excluded_brand: 'the brand is handled by another supplier feed',
  skipped_no_seller: 'no PartsBazar360 seller is mapped to this store',
  skipped_wrong_store: 'the listing belongs to a different store',
};

export interface PartsBazarPublishOverrides {
  price?: number;
  title?: string;
  quantity?: number;
}

@Injectable()
export class PartsBazar360Service {
  private readonly logger = new Logger(PartsBazar360Service.name);

  constructor(
    private readonly client: PartsBazar360Client,
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
    private readonly storage: StorageService,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(CatalogProduct)
    private readonly catalogRepo: Repository<CatalogProduct>,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ListingChannelInstance)
    private readonly instanceRepo: Repository<ListingChannelInstance>,
    @InjectQueue('channels') private readonly channelsQueue: Queue,
  ) {}

  /* ─── connection management ─── */

  async getStatus() {
    const stores = await this.storeRepo.find({
      where: { channel: PARTSBAZAR360_CHANNEL },
      order: { createdAt: 'ASC' },
    });
    return {
      configured: this.client.isConfigured(),
      apiUrl: this.client.baseUrl,
      stores: stores.map((store) => ({
        storeId: store.id,
        connectionId: store.connectionId,
        storeName: store.storeName,
        sellerStoreId: store.externalStoreId,
        status: store.status,
      })),
    };
  }

  /**
   * Link a RealTrack user to one PartsBazar360 seller. The seller is
   * identified by its `storeId` on PartsBazar360 (the RealTrack store id the
   * seller was onboarded against). The link is verified against the live API
   * first, so a wrong key or unmapped seller fails here rather than on the
   * first publish.
   */
  async connect(
    userId: string,
    input: { storeName: string; sellerStoreId: string; accountName?: string },
  ) {
    if (!this.client.isConfigured()) {
      throw new BadRequestException(
        'PARTSBAZAR360_API_KEY is not configured on this server',
      );
    }
    const sellerStoreId = input.sellerStoreId.trim();

    let seller: { id: string; name: string } | null;
    try {
      seller = (await this.client.health(sellerStoreId)).seller;
    } catch (error) {
      throw new BadRequestException(
        `Could not verify PartsBazar360 seller: ${this.errorMessage(error)}`,
      );
    }

    const existing = await this.storeRepo.findOne({
      where: { channel: PARTSBAZAR360_CHANNEL, externalStoreId: sellerStoreId },
    });
    if (existing) {
      return {
        connectionId: existing.connectionId,
        storeId: existing.id,
        seller,
      };
    }

    const connection = await this.connectionRepo.save(
      this.connectionRepo.create({
        channel: PARTSBAZAR360_CHANNEL,
        userId,
        accountName:
          input.accountName?.trim() || seller?.name || 'PartsBazar360',
        externalAccountId: sellerStoreId,
        // Auth is a server-side shared secret (env), not a per-user token; the
        // column is non-null, so store an inert non-expiring placeholder.
        encryptedTokens: this.encryption.encrypt(
          JSON.stringify({
            accessToken: 'server-managed',
            expiresAt: new Date('2100-01-01T00:00:00Z').toISOString(),
          }),
        ),
        tokenExpiresAt: null,
        status: 'active',
      }),
    );
    const store = await this.storeRepo.save(
      this.storeRepo.create({
        connectionId: connection.id,
        channel: PARTSBAZAR360_CHANNEL,
        storeName: input.storeName.trim(),
        storeUrl: 'https://partsbazar360.com',
        externalStoreId: sellerStoreId,
        isPrimary: true,
        config: { marketplaceId: 'EBAY_MOTORS_US', currency: 'USD' },
      }),
    );
    this.logger.log(
      `Connected PartsBazar360 seller ${seller?.name ?? sellerStoreId} as store ${store.id}`,
    );
    return { connectionId: connection.id, storeId: store.id, seller };
  }

  async testConnection(connectionId: string) {
    const target = await this.targetFor(connectionId);
    try {
      const { seller } = await this.client.health(target.sellerStoreId);
      return { ok: true, seller };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  /* ─── publish / update ─── */

  /**
   * Publish (or re-publish) one listing. Idempotent: PartsBazar360 keys on the
   * RealTrack listing id, so a repeat updates the same offer.
   *
   * Throws `UnrecoverableError` for failures a retry cannot fix (unpublishable
   * listing, rejected key, unmapped seller) so BullMQ does not burn attempts.
   */
  async publish(
    connectionId: string,
    listingId: string,
    overrides?: PartsBazarPublishOverrides,
  ): Promise<ListingChannelInstance> {
    const target = await this.targetFor(connectionId);
    const listing = await this.listingRepo.findOneBy({ id: listingId });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    const catalog =
      (await this.catalogRepo.findOne({ where: { id: listingId } })) ??
      (listing.customLabelSku
        ? await this.catalogRepo.findOne({
            where: { sku: listing.customLabelSku },
          })
        : null);

    const instance = await this.instanceFor(target, listingId);

    const storedPhotos = storedImageUrls(listing, catalog);
    const imageUrls = await this.publicImageUrls(storedPhotos);
    if (storedPhotos.length > 0 && imageUrls.length === 0) {
      await this.refuseWithoutPhotos(
        instance,
        target.sellerStoreId,
        listingId,
        'None of this listing’s photos could be fetched or found in storage, so there is nothing to publish',
      );
    }

    const mapped = buildPartsBazarPushItem(listing, catalog, {
      marketplaceId: this.storeMarketplace(target.store),
      currency: this.storeCurrency(target.store),
      overrides,
      imageUrls,
    });
    if (!mapped.ok) {
      if (/image/i.test(mapped.reason)) {
        await this.refuseWithoutPhotos(
          instance,
          target.sellerStoreId,
          listingId,
          mapped.reason,
        );
      }
      await this.fail(instance, mapped.reason);
      throw new UnrecoverableError(mapped.reason);
    }

    instance.syncStatus = 'publishing';
    instance.lastError = null;
    instance.lastPushedVersion = listing.version;
    instance.channelSpecificData = {
      ...instance.channelSpecificData,
      warnings: mapped.warnings,
    };
    await this.instanceRepo.save(instance);

    let accepted: PartsBazarPushItemResult | undefined;
    try {
      [accepted] = await this.client.push(target.sellerStoreId, [mapped.item]);
    } catch (error) {
      await this.fail(instance, this.errorMessage(error));
      throw this.isPermanent(error)
        ? new UnrecoverableError(this.errorMessage(error))
        : error;
    }
    if (!accepted || accepted.status === 'rejected') {
      const reason = accepted?.reason ?? 'PartsBazar360 rejected the listing';
      await this.fail(instance, reason);
      throw new UnrecoverableError(reason);
    }

    // The receiver queues the import. Give it a short window to finish so the
    // common case resolves to a real answer in this same job.
    const remote = await this.awaitOutcome(target.sellerStoreId, listingId);
    await this.applyRemote(instance, remote);

    if (this.isPending(remote)) {
      await this.scheduleStatusCheck(instance.id, 1);
    }
    return instance;
  }

  /**
   * Re-check an in-flight publish. Runs as a delayed job when the receiver had
   * not finished importing by the time `publish` stopped waiting.
   */
  async reconcile(instanceId: string, attempt = 1): Promise<void> {
    const instance = await this.instanceRepo.findOneBy({ id: instanceId });
    if (!instance || instance.syncStatus !== 'publishing') return;
    const target = await this.targetFor(instance.connectionId);

    const remote = await this.client.status(
      target.sellerStoreId,
      instance.listingId,
    );
    if (this.isPending(remote)) {
      if (attempt < MAX_STATUS_CHECKS) {
        await this.scheduleStatusCheck(instance.id, attempt + 1);
      } else {
        await this.fail(
          instance,
          'PartsBazar360 did not confirm the import in time. Check the worker is running, then republish.',
        );
      }
      return;
    }
    await this.applyRemote(instance, remote);
  }

  /** Manual refresh of every PartsBazar360 instance for a listing. */
  async refresh(listingId: string) {
    const instances = await this.instanceRepo.find({
      where: { listingId, channel: PARTSBAZAR360_CHANNEL },
    });
    for (const instance of instances) {
      const target = await this.targetFor(instance.connectionId);
      const remote = await this.client.status(target.sellerStoreId, listingId);
      if (!this.isPending(remote)) await this.applyRemote(instance, remote);
    }
    return instances.map((i) => ({
      storeId: i.storeId,
      status: i.syncStatus,
      externalId: i.externalId,
      externalUrl: i.externalUrl,
      lastError: i.lastError,
    }));
  }

  /* ─── end ─── */

  async end(listingId: string): Promise<{ success: boolean }> {
    const instances = await this.instanceRepo.find({
      where: { listingId, channel: PARTSBAZAR360_CHANNEL },
    });
    if (instances.length === 0) {
      throw new NotFoundException(
        `No PartsBazar360 listing found for ${listingId}`,
      );
    }
    for (const instance of instances) {
      const target = await this.targetFor(instance.connectionId);
      await this.client.end(target.sellerStoreId, [listingId]);
      instance.syncStatus = 'ended';
      instance.lastError = null;
      await this.instanceRepo.save(instance);
    }
    return { success: true };
  }

  /* ─── internals ─── */

  private async targetFor(connectionId: string) {
    const store = await this.storeRepo.findOne({
      where: { connectionId, channel: PARTSBAZAR360_CHANNEL },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
    if (!store?.externalStoreId) {
      throw new UnrecoverableError(
        `No PartsBazar360 seller is linked to connection ${connectionId}`,
      );
    }
    return { store, sellerStoreId: store.externalStoreId, connectionId };
  }

  private async instanceFor(
    target: { store: Store; connectionId: string },
    listingId: string,
  ) {
    const existing = await this.instanceRepo.findOne({
      where: { listingId, storeId: target.store.id },
    });
    if (existing) return existing;
    return this.instanceRepo.save(
      this.instanceRepo.create({
        listingId,
        connectionId: target.connectionId,
        storeId: target.store.id,
        channel: PARTSBAZAR360_CHANNEL,
        syncStatus: 'pending',
        channelSpecificData: {},
      }),
    );
  }

  /**
   * Turn stored photo URLs into URLs PartsBazar360 can actually fetch.
   *
   * RealTrack's photos are in a private S3 bucket, and the stored name is often
   * the original (.jpg/.png) whose object was replaced by a .webp conversion.
   * For each first-party URL: use the exact object if it exists, else its .webp
   * sibling, and expose it through RealTrack's public `/api/storage/serve`
   * route. `temp/` keys are skipped (cleanup purges or relocates them, which
   * would dead-link the storefront). External URLs (eBay etc.) pass through.
   * Order is preserved; photos that cannot be found are dropped.
   */
  private async publicImageUrls(urls: string[]): Promise<string[]> {
    const base = (
      this.config.get<string>('PARTSBAZAR360_IMAGE_BASE_URL') ||
      this.config.get<string>('FRONTEND_BASE_URL') ||
      ''
    )
      .trim()
      .replace(/\/+$/, '');

    const mirror = !/^(0|false|no|off)$/i.test(
      String(
        this.config.get<string>('PARTSBAZAR360_MIRROR_IMAGES') ?? 'true',
      ).trim(),
    );

    const resolveOne = async (url: string): Promise<string | null> => {
      const key = this.storage.keyFromUrl(url);
      let s3Key: string | null;
      if (key) {
        if (this.storage.isTempKey(key)) return null;
        s3Key = await this.webpKeyFor(key);
      } else if (mirror) {
        s3Key = await this.mirrorExternalAsWebp(url);
      } else {
        return url;
      }
      if (!s3Key) return null;
      if (!base) {
        this.logger.warn(
          'PARTSBAZAR360_IMAGE_BASE_URL / FRONTEND_BASE_URL not set; cannot expose photos publicly',
        );
        return null;
      }
      const path = s3Key.split('/').map(encodeURIComponent).join('/');
      return `${base}/api/storage/serve/${path}`;
    };

    const resolved: Array<string | null> = new Array(urls.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const i = next++;
        resolved[i] = await resolveOne(urls[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
    return resolved.filter((u): u is string => Boolean(u));
  }

  /** Resize (max 1600px) and convert to WebP; null when unreadable or too small to be a real photo. */
  private async toWebp(
    input: Buffer,
    options: { minSide?: number } = {},
  ): Promise<Buffer | null> {
    try {
      const image = sharp(input, { failOn: 'none' });
      const meta = await image.metadata();
      if (
        options.minSide &&
        Math.min(meta.width ?? 0, meta.height ?? 0) < options.minSide
      ) {
        return null;
      }
      return await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return null;
    }
  }

  /**
   * The WebP object to serve for a first-party key: the .webp sibling if it
   * exists, else the object itself when it is already WebP, else a WebP copy
   * made from the original (which stays untouched). Null when nothing exists.
   */
  private async webpKeyFor(key: string): Promise<string | null> {
    const webp = key.replace(/\.[a-z0-9]+$/i, '.webp');
    if (webp !== key && (await this.storage.objectExists(webp))) return webp;
    if (!(await this.storage.objectExists(key))) return null;
    if (webp === key) return key;
    try {
      const out = await this.toWebp(await this.storage.getObjectBuffer(key));
      if (!out) return key;
      await this.storage.putObject(webp, out, 'image/webp');
      return webp;
    } catch {
      return key; // still S3-backed; the serve route falls back to the original
    }
  }

  /**
   * Download an external photo (NAPA, eBay, …), convert it to WebP and store it
   * in S3 under a key derived from the source URL, so a re-publish reuses the
   * object and PartsBazar360 never hot-links a third party. Null when the
   * source cannot be fetched or is not a usable image.
   */
  private async mirrorExternalAsWebp(url: string): Promise<string | null> {
    const s3Key = this.storage.mirroredObjectKey('partsbazar360', url, '.webp');
    if (await this.storage.objectExists(s3Key)) return s3Key;

    // NAPA Canada's CDN refuses server-side fetches, but the same image ids are
    // served by NAPA Online. eBay thumbnails are upgraded to the large size.
    const source = url
      .replace('//media.napacanada.com/', '//media.napaonline.com/')
      .replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, '/s-l1600.$1');
    try {
      const res = await fetch(source, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OmniCore-image-mirror/1.0)',
          Accept: 'image/*',
        },
      });
      if (!res.ok) {
        this.logger.warn(
          `Photo fetch HTTP ${res.status}: ${source.slice(0, 90)}`,
        );
        return null;
      }
      if (!/^image\//i.test(res.headers.get('content-type') ?? '')) return null;
      const out = await this.toWebp(Buffer.from(await res.arrayBuffer()), {
        minSide: 100,
      });
      if (!out) return null;
      await this.storage.putObject(s3Key, out, 'image/webp');
      return s3Key;
    } catch (error) {
      this.logger.warn(
        `Photo mirror failed for ${source.slice(0, 90)}: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * A listing with no usable photo must not be on the storefront: refuse the
   * publish, and if it is already live on PartsBazar360, take it off sale.
   */
  private async refuseWithoutPhotos(
    instance: ListingChannelInstance,
    sellerStoreId: string,
    listingId: string,
    reason: string,
  ): Promise<never> {
    let message = reason;
    if (instance.externalId) {
      try {
        await this.client.end(sellerStoreId, [listingId]);
        message = `${reason} — taken off sale on PartsBazar360`;
      } catch (error) {
        message = `${reason} — could NOT be taken off sale: ${this.errorMessage(error)}`;
      }
    }
    await this.fail(instance, message);
    throw new UnrecoverableError(message);
  }

  private async awaitOutcome(
    sellerStoreId: string,
    listingId: string,
  ): Promise<PartsBazarStatusResponse> {
    const tries = this.number('PARTSBAZAR360_CONFIRM_TRIES', 5);
    const interval = this.number('PARTSBAZAR360_CONFIRM_INTERVAL_MS', 3_000);
    let remote = await this.client.status(sellerStoreId, listingId);
    for (let i = 1; i < tries && this.isPending(remote); i++) {
      if (interval > 0) await new Promise((r) => setTimeout(r, interval));
      remote = await this.client.status(sellerStoreId, listingId);
    }
    return remote;
  }

  /** `queued` is in flight; `unknown` right after a push means not started yet. */
  private isPending(remote: PartsBazarStatusResponse) {
    return remote.status === 'queued' || remote.status === 'unknown';
  }

  private async applyRemote(
    instance: ListingChannelInstance,
    remote: PartsBazarStatusResponse,
  ) {
    instance.channelSpecificData = {
      ...instance.channelSpecificData,
      remote: {
        status: remote.status,
        outcome: remote.outcome,
        offerId: remote.offer?.id ?? null,
        partId: remote.part?.id ?? null,
        checkedAt: new Date().toISOString(),
      },
    };
    switch (remote.status) {
      case 'imported':
        instance.syncStatus = 'synced';
        instance.externalId = remote.offer?.id ?? instance.externalId;
        instance.externalUrl = remote.part?.url ?? instance.externalUrl;
        instance.lastSyncedAt = new Date();
        instance.lastError = null;
        instance.retryCount = 0;
        await this.instanceRepo.save(instance);
        return;
      case 'ended':
        instance.syncStatus = 'ended';
        await this.instanceRepo.save(instance);
        return;
      case 'rejected': {
        const why = remote.outcome
          ? (OUTCOME_MESSAGES[remote.outcome] ?? remote.outcome)
          : 'unknown reason';
        await this.fail(instance, `PartsBazar360 declined the listing: ${why}`);
        return;
      }
      case 'failed':
        await this.fail(
          instance,
          `PartsBazar360 failed to import the listing: ${remote.error ?? 'unknown error'}`,
        );
        return;
      default:
        await this.instanceRepo.save(instance);
    }
  }

  private async fail(instance: ListingChannelInstance, message: string) {
    instance.syncStatus = 'error';
    instance.lastError = message.slice(0, 1000);
    instance.retryCount = (instance.retryCount ?? 0) + 1;
    await this.instanceRepo.save(instance);
  }

  private scheduleStatusCheck(instanceId: string, attempt: number) {
    return this.channelsQueue.add(
      PARTSBAZAR360_STATUS_JOB,
      { instanceId, attempt },
      {
        delay: 30_000 * attempt,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  /** Auth/mapping/validation failures will not heal on retry. */
  private isPermanent(error: unknown) {
    return (
      error instanceof PartsBazarApiError &&
      !error.retryable &&
      error.status !== null
    );
  }

  private storeMarketplace(store: Store) {
    const value = store.config?.['marketplaceId'];
    return typeof value === 'string' && value ? value : 'EBAY_MOTORS_US';
  }

  private storeCurrency(store: Store) {
    const value = store.config?.['currency'];
    return typeof value === 'string' && value ? value : 'USD';
  }

  private number(name: string, fallback: number) {
    const value = Number(this.config.get<string>(name));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
