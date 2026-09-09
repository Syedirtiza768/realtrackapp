import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { type AxiosResponse } from 'axios';
import { Repository } from 'typeorm';
import { EbayHostedImage } from '../../integrations/ebay/entities/ebay-hosted-image.entity.js';
import { EbayAuthService } from './ebay-auth.service.js';
import { sanitizeEbayImageUrls } from './ebay-listing-images.util.js';

interface EbayImageResponse {
  imageUrl?: string;
  maxDimensionImageUrl?: string;
  expirationDate?: string;
}

interface ImageResolution {
  sourceUrl: string;
  hostedUrl?: string;
  error?: Error;
}

const IMAGE_CACHE_EXPIRY_BUFFER_MS = 60 * 60 * 1000;
const IMAGE_UPLOAD_CONCURRENCY = 3;
const IMAGE_UPLOAD_MAX_ATTEMPTS = 3;
const IMAGE_UPLOAD_RETRY_DELAYS_MS = [500, 1_500];

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
    const sanitized = sanitizeEbayImageUrls(sourceUrls);
    if (sanitized.warnings.length) {
      this.logger.warn(
        `Image source normalization for store ${storeId}: ${sanitized.warnings.join('; ')}`,
      );
    }
    const urls = [
      ...new Set(
        sanitized.imageUrls
          .map((url) => url?.trim())
          .filter((url): url is string => Boolean(url)),
      ),
    ];

    const resolutions = await this.mapWithConcurrency(
      urls,
      IMAGE_UPLOAD_CONCURRENCY,
      async (sourceUrl): Promise<ImageResolution> => {
        try {
          return {
            sourceUrl,
            hostedUrl: await this.hostImage(storeId, sourceUrl),
          };
        } catch (error: unknown) {
          return {
            sourceUrl,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    );

    const failures = resolutions.filter(
      (resolution): resolution is ImageResolution & { error: Error } =>
        Boolean(resolution.error),
    );
    const fatalFailure = failures.find(
      (resolution) => !this.isRecoverableImageFailure(resolution.error),
    );
    if (fatalFailure?.error) throw fatalFailure.error;

    const hosted = resolutions
      .filter(
        (resolution): resolution is ImageResolution & { hostedUrl: string } =>
          typeof resolution.hostedUrl === 'string' &&
          resolution.hostedUrl.length > 0,
      )
      .map(({ hostedUrl }) => hostedUrl);

    if (!hosted.length && failures.length) {
      throw failures[0].error;
    }

    if (failures.length) {
      this.logger.warn(
        `Skipped ${failures.length} recoverable listing image failure(s) after eBay Picture Services errors for store ${storeId}`,
      );
    }

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

    let response: AxiosResponse<EbayImageResponse> | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= IMAGE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
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
        break;
      } catch (error: unknown) {
        lastError = error;
        if (
          attempt >= IMAGE_UPLOAD_MAX_ATTEMPTS ||
          !this.isTransientMediaFailure(error)
        ) {
          throw this.formatUploadError(error);
        }
        await this.sleep(IMAGE_UPLOAD_RETRY_DELAYS_MS[attempt - 1] ?? 1_500);
      }
    }

    if (!response) {
      throw this.formatUploadError(lastError);
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

  private isTransientMediaFailure(error: unknown): boolean {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    const code = axios.isAxiosError(error) ? error.code : undefined;
    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

    return (
      [408, 425, 429, 500, 502, 503, 504].includes(status ?? 0) ||
      ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(
        code ?? '',
      ) ||
      /timeout|timed out|connection reset|socket hang up|upstream/.test(message)
    );
  }

  private isRecoverableImageFailure(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      /no valid image can be downloaded/.test(message) ||
      /ebay picture services upload failed \((408|425|429|500|502|503|504)\)/i.test(
        message,
      ) ||
      /timeout|timed out|connection reset|socket hang up|upstream/.test(message)
    );
  }

  private formatUploadError(error: unknown): Error {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    const detail =
      axios.isAxiosError(error) && error.response?.data
        ? this.readApiError(error.response.data)
        : error instanceof Error
          ? error.message
          : String(error);
    return new Error(
      `eBay Picture Services upload failed${status ? ` (${status})` : ''}: ${detail}`,
    );
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
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
