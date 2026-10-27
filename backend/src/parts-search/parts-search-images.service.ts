import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as archiver from 'archiver';
import type { Response } from 'express';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { DataSource } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import type { User } from '../auth/entities/user.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { PartsSearchService } from './parts-search.service.js';

const PARTSBAZAR360_ORIGIN = 'https://partsbazar360.com';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_IMAGES = 30;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

/** Where the best available copy of an image lives. */
export type ImageSource =
  | { kind: 'bucket'; key: string; candidates: string[] }
  | { kind: 'remote'; url: string; fallbackUrl?: string };

export interface PartImage {
  index: number;
  /** Browser-loadable, highest-quality preview URL. */
  previewUrl: string;
  filename: string;
  origin: 'omni-core-storage' | 'ebay' | 'partsbazar360' | 'web';
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/tiff': 'tif',
};

/** Responsive variants generated next to originals in our bucket. */
const VARIANT_RE = /_(thumb|sm|medium|lg)\.webp$/i;

/**
 * Upgrade an eBay image URL to the largest rendition eBay serves (1600 px):
 * `…/s-l500.jpg` → `…/s-l1600.jpg`, `…/$_1.JPG` → `…/$_57.JPG`, and drop the
 * `/thumbs` path segment.
 */
export function upgradeEbayUrl(url: string): string {
  return url
    .replace('/thumbs/images/', '/images/')
    .replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, '/s-l1600.$1')
    .replace(/\/\$_\d+\.(jpg|jpeg|png|webp)/i, '/$_57.$1');
}

function isEbayHost(host: string): boolean {
  return /(^|\.)ebayimg\.com$/i.test(host) || /(^|\.)ebaystatic\.com$/i.test(host);
}

/** Private, loopback, link-local and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(lower);
  }
  return true;
}

function safeName(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'part'
  );
}

/**
 * High-quality part image downloads for the Parts Search portal.
 *
 * Image URLs come from PartsBazar360 part data (never from the browser), so the
 * request can only name a part and an index. Our own bucket is read through
 * StorageService (the bucket is private); eBay images are upgraded to their
 * largest rendition; any other host is fetched only over http(s) to a public
 * address, ≤ 25 MB, image/* only, re-checking every redirect hop.
 */
@Injectable()
export class PartsSearchImagesService {
  private readonly logger = new Logger(PartsSearchImagesService.name);
  private readonly bucket: string;

  constructor(
    private readonly partsSearch: PartsSearchService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly userOrgs: UserOrganizationService,
  ) {
    // Same resolution as StorageService (kept private there).
    this.bucket =
      this.config.get<string>('AWS_S3_BUCKET')?.trim() || this.config.get<string>('S3_BUCKET')?.trim() || 'realtrack-images';
  }

  // ------------------------------------------------------------ resolve

  /** Classify a stored image URL and point at its best (original) copy. */
  resolve(raw: string): ImageSource | null {
    const value = String(raw ?? '').trim();
    if (!value) return null;
    if (value.startsWith('/api/storage/serve/')) {
      return this.bucketSource(decodeURIComponent(value.slice('/api/storage/serve/'.length)));
    }
    let url: URL;
    try {
      url = new URL(value.startsWith('/') ? `${PARTSBAZAR360_ORIGIN}${value}` : value.startsWith('//') ? `https:${value}` : value);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    const bucket = this.bucket.toLowerCase();
    if (host === `${bucket}.s3.amazonaws.com` || (host.startsWith(`${bucket}.s3.`) && host.endsWith('.amazonaws.com'))) {
      return this.bucketSource(decodeURIComponent(url.pathname.replace(/^\/+/, '')));
    }
    if ((host === 's3.amazonaws.com' || /^s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host)) && url.pathname.startsWith(`/${this.bucket}/`)) {
      return this.bucketSource(decodeURIComponent(url.pathname.slice(this.bucket.length + 2)));
    }
    if (isEbayHost(host)) {
      const upgraded = upgradeEbayUrl(url.toString());
      return upgraded === url.toString() ? { kind: 'remote', url: upgraded } : { kind: 'remote', url: upgraded, fallbackUrl: url.toString() };
    }
    return { kind: 'remote', url: url.toString() };
  }

  private bucketSource(key: string): ImageSource | null {
    const clean = key.replace(/^\/+/, '').split('?')[0];
    if (!clean || clean.includes('..')) return null;
    if (!VARIANT_RE.test(clean)) return { kind: 'bucket', key: clean, candidates: [clean] };
    // A responsive variant was stored: the original sits next to it.
    const base = clean.replace(VARIANT_RE, '');
    return { kind: 'bucket', key: clean, candidates: ['jpg', 'jpeg', 'png', 'webp'].map((ext) => `${base}.${ext}`).concat(clean) };
  }

  private previewUrl(source: ImageSource): string {
    return source.kind === 'bucket' ? `/api/storage/serve/${source.candidates[0]}` : source.url;
  }

  private originOf(source: ImageSource): PartImage['origin'] {
    if (source.kind === 'bucket') return 'omni-core-storage';
    const host = new URL(source.url).hostname;
    if (isEbayHost(host)) return 'ebay';
    if (/partsbazar360\.com$/i.test(host)) return 'partsbazar360';
    return 'web';
  }

  // ------------------------------------------------------------ part images

  private async partImageUrls(partId: string): Promise<{ urls: string[]; label: string }> {
    const part = (await this.partsSearch.part(partId)) as {
      imageUrls?: unknown;
      manufacturerPartNumber?: string | null;
      title?: string;
      brand?: string | null;
    };
    const urls = (Array.isArray(part.imageUrls) ? part.imageUrls : [])
      .map((url) => String(url ?? '').trim())
      .filter((url) => url && !/\.svg(\?|$)/i.test(url));
    const label = [part.brand, part.manufacturerPartNumber].filter(Boolean).join(' ') || part.title || partId;
    return { urls: [...new Set(urls)], label };
  }

  async listPartImages(partId: string): Promise<{ partId: string; label: string; images: PartImage[] }> {
    const { urls, label } = await this.partImageUrls(partId);
    const images: PartImage[] = [];
    urls.forEach((url, index) => {
      const source = this.resolve(url);
      if (!source) return;
      images.push({
        index,
        previewUrl: this.previewUrl(source),
        filename: `${safeName(label)}-${index + 1}`,
        origin: this.originOf(source),
      });
    });
    return { partId, label, images };
  }

  async downloadPartImage(partId: string, index: number, res: Response): Promise<void> {
    const { urls, label } = await this.partImageUrls(partId);
    const raw = urls[index];
    if (raw === undefined) throw new NotFoundException('Image not found');
    const source = this.resolve(raw);
    if (!source) throw new NotFoundException('Image is not downloadable');
    const file = await this.fetchBest(source);
    this.send(res, file, `${safeName(label)}-${index + 1}`);
  }

  async downloadPartZip(partId: string, res: Response): Promise<void> {
    const { urls, label } = await this.partImageUrls(partId);
    if (!urls.length) throw new NotFoundException('This part has no images');
    const name = safeName(label);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}-images.zip"`);
    res.setHeader('Cache-Control', 'private, no-store');
    const zip = archiver.default('zip', { store: true });
    zip.on('error', (error) => {
      this.logger.warn(`zip failed for ${partId}: ${error.message}`);
      res.destroy(error);
    });
    zip.pipe(res);
    const failed: string[] = [];
    for (const [index, raw] of urls.slice(0, MAX_ZIP_IMAGES).entries()) {
      const source = this.resolve(raw);
      try {
        if (!source) throw new Error('unsupported URL');
        const file = await this.fetchBest(source);
        zip.append(file.body, { name: `${name}-${index + 1}.${file.ext}` });
      } catch (error) {
        failed.push(`${index + 1}: ${raw} (${(error as Error).message})`);
      }
    }
    if (failed.length) zip.append(`These images could not be downloaded:\n${failed.join('\n')}\n`, { name: 'MISSING.txt' });
    await zip.finalize();
  }

  /** Image of an Omni Core warehouse item (results "In our warehouse"), org-scoped. */
  async downloadOmniImage(inventoryItemId: string, user: User, res: Response): Promise<void> {
    const orgIds = (await this.userOrgs.listForUser(user.id)).map((org) => org.organizationId);
    if (!orgIds.length) throw new NotFoundException('Image not found');
    const rows: Array<{ image: string | null; label: string | null }> = await this.dataSource.query(
      `SELECT coalesce(ii.image_url, cp.image_urls[1]) AS image, coalesce(cp.mpn, ii.sku) AS label
         FROM inventory_items ii LEFT JOIN catalog_products cp ON cp.id = ii.catalog_product_id
        WHERE ii.id = $1 AND ii.organization_id = ANY($2::uuid[]) LIMIT 1`,
      [inventoryItemId, orgIds],
    );
    const raw = rows[0]?.image;
    const source = raw ? this.resolve(raw) : null;
    if (!source) throw new NotFoundException('Image not found');
    const file = await this.fetchBest(source);
    this.send(res, file, safeName(rows[0]?.label ?? 'omni-core-part'));
  }

  // --------------------------------------------------------------- fetch

  private send(res: Response, file: { body: Buffer; contentType: string; ext: string }, base: string): void {
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.body.length));
    res.setHeader('Content-Disposition', `attachment; filename="${base}.${file.ext}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(file.body);
  }

  async fetchBest(source: ImageSource): Promise<{ body: Buffer; contentType: string; ext: string }> {
    if (source.kind === 'bucket') {
      let lastError: unknown;
      for (const key of source.candidates) {
        try {
          const object = await this.storage.getObjectStream(key);
          const body = await this.readLimited(object.stream as unknown as Readable);
          return this.typed(body, object.contentType);
        } catch (error) {
          lastError = error;
        }
      }
      this.logger.debug(`bucket image missing: ${source.key} (${(lastError as Error)?.message})`);
      throw new NotFoundException('Image not found in storage');
    }
    try {
      return await this.fetchRemote(source.url);
    } catch (error) {
      // Some old eBay listings have no 1600 px rendition: use the stored size.
      if (source.fallbackUrl && error instanceof NotFoundException) return this.fetchRemote(source.fallbackUrl);
      throw error;
    }
  }

  private async fetchRemote(start: string): Promise<{ body: Buffer; contentType: string; ext: string }> {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new BadRequestException('Unsupported image URL');
      if (parsed.port && !['80', '443'].includes(parsed.port)) throw new BadRequestException('Unsupported image port');
      await this.assertPublicHost(parsed.hostname);
      let response: globalThis.Response;
      try {
        response = await fetch(url, {
          redirect: 'manual',
          headers: { Accept: 'image/*', 'User-Agent': 'OmniCore-PartsSearch/1.0' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
      } catch (error) {
        throw new ServiceUnavailableException(`Image host did not answer: ${(error as Error).message}`);
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new ServiceUnavailableException('Image host redirected without a location');
        url = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) {
        // eBay serves smaller renditions for some old listings only.
        if (response.status === 404 && url !== start) throw new NotFoundException('Image not found');
        throw new NotFoundException(`Image host returned HTTP ${response.status}`);
      }
      const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!contentType.startsWith('image/')) throw new BadRequestException('The URL is not an image');
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_BYTES) throw new BadRequestException('Image is larger than 25 MB');
      if (!response.body) throw new NotFoundException('Image host returned an empty body');
      const body = await this.readLimited(Readable.fromWeb(response.body as never));
      return this.typed(body, contentType);
    }
    throw new ServiceUnavailableException('Too many redirects');
  }

  private async assertPublicHost(hostname: string): Promise<void> {
    const host = hostname.replace(/^\[|\]$/g, '');
    if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new BadRequestException('Image host is not public');
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => []);
    if (!addresses.length) throw new NotFoundException('Image host not found');
    if (addresses.some(({ address }) => isPrivateAddress(address))) throw new BadRequestException('Image host is not public');
  }

  private async readLimited(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      total += buffer.length;
      if (total > MAX_BYTES) {
        stream.destroy();
        throw new BadRequestException('Image is larger than 25 MB');
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  private typed(body: Buffer, contentType: string): { body: Buffer; contentType: string; ext: string } {
    const type = contentType.split(';')[0].trim().toLowerCase();
    const ext = EXT_BY_TYPE[type] ?? (type.startsWith('image/') ? type.slice(6).replace(/[^a-z0-9]/g, '') || 'img' : 'img');
    return { body, contentType: type.startsWith('image/') ? type : 'application/octet-stream', ext };
  }
}
