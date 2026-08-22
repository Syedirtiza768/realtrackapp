import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { type AxiosResponse } from 'axios';
import { Repository } from 'typeorm';
import { EbayHostedImage } from '../../integrations/ebay/entities/ebay-hosted-image.entity.js';
import { EbayAuthService } from './ebay-auth.service.js';

interface EbayImageResponse {
  imageUrl?: string;
  maxDimensionImageUrl?: string;
  expirationDate?: string;
}

const IMAGE_CACHE_EXPIRY_BUFFER_MS = 60 * 60 * 1000;
const IMAGE_UPLOAD_CONCURRENCY = 3;

/**
 * Uploads listing images to eBay Picture Services (EPS).
 *
 * eBay's Inventory API accepts self-hosted URLs, but those URLs remain
 * dependent on the source host. EPS returns an eBay-owned URL that can be
 * used by both the Inventory API and SellerPundit's eBay publish endpoint.
 */
@Injectable()
export class EbayMediaApiService {
  private readonly logger = new Logger(EbayMediaApiService.name);

  constructor(
    private readonly auth: EbayAuthService,
    @InjectRepository(EbayHostedImage)
    private readonly hostedImageRepo: Repository<EbayHostedImage>,
  ) {}

  /**
   * Resolve all listing images to eBay-hosted URLs, preserving input order.
   * Already-hosted eBay URLs are passed through without an API call.
   */
  async hostImages(storeId: string, sourceUrls: string[]): Promise<string[]> {
    const urls = [
      ...new Set(
        sourceUrls
          .map((url) => url?.trim())
          .filter((url): url is string => Boolean(url)),
      ),
    ];

    const hosted = await this.mapWithConcurrency(
      urls,
      IMAGE_UPLOAD_CONCURRENCY,
      (sourceUrl) => this.hostImage(storeId, sourceUrl),
    );

    this.logger.debug(
      `Resolved ${hosted.length} listing image(s) to eBay Picture Services for store ${storeId}`,
    );
    return hosted;
  }

  private async hostImage(storeId: string, sourceUrl: string): Promise<string> {
    if (this.isEbayHostedUrl(sourceUrl)) return sourceUrl;

    // Query strings on S3 URLs are often temporary signatures. They are not
    // part of the image identity, and must not be persisted in the cache.
    const sourceKey = this.cacheKey(sourceUrl);
    const cached = await this.hostedImageRepo.findOne({
      where: { storeId, sourceUrl: sourceKey },
    });
    if (cached && this.cacheEntryIsUsable(cached)) {
      return cached.hostedUrl;
    }

    const token = await this.auth.getAccessToken(storeId);
    const apiBaseUrl = await this.auth.getApiBaseUrlForStore(storeId);
    const mediaBaseUrl = this.mediaApiBaseUrl(apiBaseUrl);

    let response: AxiosResponse<EbayImageResponse>;
    try {
      response = await axios.post<EbayImageResponse>(
        `${mediaBaseUrl}/commerce/media/v1_beta/image/create_image_from_url`,
        { imageUrl: sourceUrl },
        {
          timeout: 30_000,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error: unknown) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      const detail =
        axios.isAxiosError(error) && error.response?.data
          ? this.readApiError(error.response.data)
          : error instanceof Error
            ? error.message
            : String(error);
      throw new Error(
        `eBay Picture Services upload failed${status ? ` (${status})` : ''}: ${detail}`,
      );
    }

    const hostedUrl =
      response.data.maxDimensionImageUrl?.trim() ||
      response.data.imageUrl?.trim();
    if (!hostedUrl) {
      throw new Error(
        'eBay Picture Services returned no hosted image URL; the listing was not published',
      );
    }

    const responseHeaders = response.headers as unknown as Record<
      string,
      unknown
    >;
    const locationValue =
      responseHeaders['location'] ?? responseHeaders['Location'];
    const imageId =
      typeof locationValue === 'string'
        ? locationValue.split('/').filter(Boolean).pop()
        : null;
    const expirationDate = response.data.expirationDate
      ? new Date(response.data.expirationDate)
      : null;

    await this.hostedImageRepo.upsert(
      {
        storeId,
        sourceUrl: sourceKey,
        hostedUrl,
        imageId,
        expirationDate:
          expirationDate && Number.isFinite(expirationDate.getTime())
            ? expirationDate
            : null,
      },
      ['storeId', 'sourceUrl'],
    );

    return hostedUrl;
  }

  private cacheEntryIsUsable(entry: EbayHostedImage): boolean {
    if (!entry.hostedUrl?.trim()) return false;
    if (!entry.expirationDate) return true;
    return (
      entry.expirationDate.getTime() > Date.now() + IMAGE_CACHE_EXPIRY_BUFFER_MS
    );
  }

  private cacheKey(sourceUrl: string): string {
    try {
      const parsed = new URL(sourceUrl);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return sourceUrl;
    }
  }

  private isEbayHostedUrl(sourceUrl: string): boolean {
    try {
      const hostname = new URL(sourceUrl).hostname.toLowerCase();
      return (
        hostname === 'ebayimg.com' ||
        hostname.endsWith('.ebayimg.com') ||
        hostname === 'ebaystatic.com' ||
        hostname.endsWith('.ebaystatic.com')
      );
    } catch {
      return false;
    }
  }

  private mediaApiBaseUrl(apiBaseUrl: string): string {
    const normalized = apiBaseUrl.replace(/\/+$/, '');
    return normalized.replace(/^https:\/\/api(?=\.|$)/i, 'https://apim');
  }

  private readApiError(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return 'unknown eBay error';
    const body = value as Record<string, unknown>;
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.errors)) {
      const messages = body.errors
        .map((error) => {
          if (typeof error === 'string') return error;
          if (error && typeof error === 'object') {
            const message = (error as Record<string, unknown>).message;
            return typeof message === 'string' ? message : null;
          }
          return null;
        })
        .filter((message): message is string => Boolean(message));
      if (messages.length) return messages.join('; ');
    }
    return 'unknown eBay error';
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const run = async (): Promise<void> => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(Math.max(1, concurrency), items.length) },
        () => run(),
      ),
    );
    return results;
  }
}
