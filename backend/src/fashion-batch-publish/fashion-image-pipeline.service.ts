import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service.js';
import type {
  ImageVariantName,
  PipelineImage,
} from './entities/fashion-publish.entities.js';

/** eBay rejects photos under 500px on the longest side. */
export const EBAY_MIN_LONGEST_SIDE = 500;
/** Below this we still list, but flag the photo as low quality. */
export const LOW_QUALITY_LONGEST_SIDE = 1600;
export const EBAY_MASTER_MAX_LONGEST_SIDE = 2000;
/** eBay allows 24 photos per listing in most categories. */
export const EBAY_MAX_IMAGES = 24;

const FETCH_TIMEOUT_MS = 30_000;
const FETCH_ATTEMPTS = 3;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

interface VariantSpec {
  name: Exclude<ImageVariantName, 'original'>;
  ext: 'webp' | 'jpg';
  contentType: string;
  longest: number;
  quality: number;
}

export const IMAGE_VARIANTS: VariantSpec[] = [
  { name: 'thumb', ext: 'webp', contentType: 'image/webp', longest: 200, quality: 75 },
  { name: 'small', ext: 'webp', contentType: 'image/webp', longest: 600, quality: 80 },
  { name: 'large', ext: 'webp', contentType: 'image/webp', longest: 1600, quality: 82 },
  {
    name: 'ebay_master',
    ext: 'jpg',
    contentType: 'image/jpeg',
    longest: EBAY_MASTER_MAX_LONGEST_SIDE,
    quality: 90,
  },
];

/** Quality flags for an image's displayed (EXIF-rotated) size. */
export function dimensionFlags(width: number, height: number): string[] {
  const longest = Math.max(width, height);
  const flags: string[] = [];
  if (longest < EBAY_MIN_LONGEST_SIDE) flags.push('below_min');
  if (longest < LOW_QUALITY_LONGEST_SIDE) flags.push('low_quality');
  return flags;
}

/** Displayed width/height after applying EXIF orientation 5–8 (90° turns). */
export function orientedSize(meta: {
  width?: number;
  height?: number;
  orientation?: number;
}): { width: number; height: number } {
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  return (meta.orientation ?? 1) >= 5 ? { width: h, height: w } : { width: w, height: h };
}

const EXT_BY_FORMAT: Record<string, string> = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  tiff: 'tif',
  heif: 'heic',
  avif: 'avif',
  bmp: 'bmp',
};

export interface ImagePipelineResult {
  images: PipelineImage[];
  /** S3 URLs of eBay masters for images not excluded, in listing order. */
  masterUrls: string[];
}

/**
 * Source URL → S3 original + thumb/small/large WebP + eBay JPEG master.
 *
 * Keys: `{prefix}catalog/{listingId}/{sha256}/{variant}.{ext}`. The content
 * hash makes re-runs idempotent and stores duplicate photos once. All variants
 * are auto-rotated from EXIF, converted to sRGB and stripped of metadata
 * (sharp drops EXIF/GPS unless asked to keep it). Images are never upscaled.
 */
@Injectable()
export class FashionImagePipelineService {
  private readonly logger = new Logger(FashionImagePipelineService.name);

  constructor(private readonly storage: StorageService) {}

  async process(
    listingId: string,
    sourceUrls: string[],
    previous: PipelineImage[] = [],
  ): Promise<ImagePipelineResult> {
    const urls = sourceUrls
      .map((u) => u?.trim())
      .filter((u): u is string => !!u && /^https?:\/\//i.test(u));
    const byHash = new Map<string, PipelineImage>();
    for (const p of previous) if (p.hash && !p.error) byHash.set(p.hash, p);

    const images: PipelineImage[] = [];
    const seenHashes = new Set<string>();
    for (const [index, sourceUrl] of urls.entries()) {
      const image = await this.processOne(listingId, index, sourceUrl, byHash);
      if (image.hash && seenHashes.has(image.hash)) {
        image.excluded = {
          code: 'IMAGE_DUPLICATE',
          reason: 'Same photo appears earlier in the listing',
        };
      }
      if (image.hash) seenHashes.add(image.hash);
      images.push(image);
    }

    let kept = 0;
    for (const image of images) {
      if (image.excluded || image.error) continue;
      if (kept >= EBAY_MAX_IMAGES) {
        image.excluded = {
          code: 'IMAGE_OVER_LIMIT',
          reason: `eBay allows ${EBAY_MAX_IMAGES} photos per listing`,
        };
        continue;
      }
      kept += 1;
    }
    return { images, masterUrls: ebayMasterUrls(images) };
  }

  private async processOne(
    listingId: string,
    index: number,
    sourceUrl: string,
    previousByHash: Map<string, PipelineImage>,
  ): Promise<PipelineImage> {
    const image: PipelineImage = {
      index,
      sourceUrl,
      hash: null,
      width: null,
      height: null,
      bytes: null,
      format: null,
      keys: {},
      urls: {},
      flags: [],
      excluded: null,
      error: null,
    };
    try {
      const buffer = await this.fetchImage(sourceUrl);
      image.bytes = buffer.length;
      image.hash = createHash('sha256').update(buffer).digest('hex');

      const meta = await sharp(buffer, { failOn: 'none' }).metadata();
      if (!meta.format || !meta.width || !meta.height)
        throw new Error('File is not a readable image');
      image.format = meta.format;
      const { width, height } = orientedSize(meta);
      image.width = width;
      image.height = height;
      image.flags = dimensionFlags(width, height);

      const baseKey = this.storage.buildDurableKey(
        `catalog/${listingId}/${image.hash}`,
      );
      const ext = EXT_BY_FORMAT[meta.format] ?? 'bin';
      image.keys.original = `${baseKey}/original.${ext}`;
      for (const v of IMAGE_VARIANTS)
        image.keys[v.name] = `${baseKey}/${v.name}.${v.ext}`;

      const previous = previousByHash.get(image.hash);
      const alreadyStored =
        previous?.keys.ebay_master === image.keys.ebay_master &&
        (await this.storage.objectExists(image.keys.ebay_master!));
      if (alreadyStored) {
        image.reused = true;
      } else {
        await this.storage.putObject(
          image.keys.original,
          buffer,
          `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`,
        );
        const variants = await renderVariants(buffer);
        for (const v of IMAGE_VARIANTS) {
          await this.storage.putObject(
            image.keys[v.name]!,
            variants[v.name],
            v.contentType,
          );
        }
      }
      for (const name of Object.keys(image.keys) as ImageVariantName[])
        image.urls[name] = this.storage.getCdnUrl(image.keys[name]!);

      if (image.flags.includes('below_min')) {
        image.excluded = {
          code: 'IMAGE_TOO_SMALL',
          reason: `Longest side ${Math.max(width, height)}px is under eBay's ${EBAY_MIN_LONGEST_SIDE}px minimum`,
        };
      }
    } catch (error) {
      image.error = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Image ${index} for ${listingId} failed: ${image.error} (${sourceUrl.slice(0, 120)})`,
      );
    }
    return image;
  }

  /** Read from our own bucket directly; otherwise HTTP with timeout + retries. */
  private async fetchImage(url: string): Promise<Buffer> {
    const key = this.storage.keyFromUrl(url);
    if (key) {
      const buf = await this.storage.getObjectBuffer(key);
      if (!buf.length) throw new Error('Stored image is empty');
      return buf;
    }
    let lastError: unknown;
    for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { 'User-Agent': 'OmniCore-fashion-publish/1.0' },
        });
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status} fetching image`);
          // 4xx other than 408/429 will not get better on retry.
          if (res.status < 500 && res.status !== 408 && res.status !== 429)
            throw Object.assign(err, { permanent: true });
          throw err;
        }
        const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
        if (type && !type.startsWith('image/') && type !== 'application/octet-stream')
          throw Object.assign(new Error(`Not an image (content-type ${type})`), {
            permanent: true,
          });
        const length = Number(res.headers.get('content-length') ?? 0);
        if (length > MAX_SOURCE_BYTES)
          throw Object.assign(new Error('Image is larger than 30 MB'), {
            permanent: true,
          });
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length) throw new Error('Empty response');
        return buf;
      } catch (error) {
        lastError = error;
        if ((error as { permanent?: boolean }).permanent || attempt === FETCH_ATTEMPTS)
          break;
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

/** Kept (not excluded, not failed) masters in listing order. */
export function ebayMasterUrls(images: PipelineImage[]): string[] {
  return images
    .filter((i) => !i.excluded && !i.error && i.urls.ebay_master)
    .slice(0, EBAY_MAX_IMAGES)
    .map((i) => i.urls.ebay_master!);
}

export async function renderVariants(
  buffer: Buffer,
): Promise<Record<Exclude<ImageVariantName, 'original'>, Buffer>> {
  // rotate() with no args applies EXIF orientation; output carries no metadata.
  const base = sharp(buffer, { failOn: 'none' }).rotate().toColourspace('srgb');
  const out = {} as Record<Exclude<ImageVariantName, 'original'>, Buffer>;
  for (const v of IMAGE_VARIANTS) {
    const pipeline = base.clone().resize(v.longest, v.longest, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    out[v.name] =
      v.ext === 'jpg'
        ? await pipeline
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: v.quality, chromaSubsampling: '4:4:4', mozjpeg: true })
            .toBuffer()
        : await pipeline.webp({ quality: v.quality }).toBuffer();
  }
  return out;
}
