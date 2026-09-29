import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PartsBazarPushItem,
  PartsBazarPushItemResult,
  PartsBazarStatusResponse,
} from './partsbazar360.types.js';

export class PartsBazarApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'PartsBazarApiError';
  }
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const DEFAULT_API_URL = 'https://partsbazar360.com/api';

/**
 * Thin HTTP client for PartsBazar360's inbound RealTrack endpoint
 * (`/integrations/realtrack/listings`). Auth is a shared secret sent as a
 * bearer token; it is read from env on each call and never logged.
 */
@Injectable()
export class PartsBazar360Client {
  private readonly logger = new Logger(PartsBazar360Client.name);

  constructor(private readonly config: ConfigService) {}

  get baseUrl(): string {
    return this.config
      .get<string>('PARTSBAZAR360_API_URL', DEFAULT_API_URL)
      .trim()
      .replace(/\/+$/, '');
  }

  private get apiKey(): string | null {
    return this.config.get<string>('PARTSBAZAR360_API_KEY')?.trim() || null;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  health(storeId?: string): Promise<{
    ok: boolean;
    seller: { id: string; name: string } | null;
  }> {
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    return this.request('GET', `/health${query}`);
  }

  async push(
    storeId: string,
    items: PartsBazarPushItem[],
  ): Promise<PartsBazarPushItemResult[]> {
    const response = await this.request<{
      results: PartsBazarPushItemResult[];
    }>('POST', '', { storeId, listings: items });
    return response.results;
  }

  async end(
    storeId: string,
    sourceListingIds: string[],
  ): Promise<Array<{ sourceListingId: string; status: string }>> {
    const response = await this.request<{
      results: Array<{ sourceListingId: string; status: string }>;
    }>('POST', '/end', { storeId, sourceListingIds });
    return response.results;
  }

  status(
    storeId: string,
    sourceListingId: string,
  ): Promise<PartsBazarStatusResponse> {
    return this.request(
      'GET',
      `/${encodeURIComponent(storeId)}/${encodeURIComponent(sourceListingId)}`,
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new PartsBazarApiError(
        'PARTSBAZAR360_API_KEY is not configured',
        null,
        false,
      );
    }

    const url = `${this.baseUrl}/integrations/realtrack/listings${path}`;
    const maxAttempts = this.number('PARTSBAZAR360_MAX_ATTEMPTS', 3);
    const timeoutMs = this.number('PARTSBAZAR360_TIMEOUT_MS', 30_000);
    const baseDelay = this.number('PARTSBAZAR360_RETRY_BASE_MS', 1_000);

    let lastError: PartsBazarApiError | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            authorization: `Bearer ${apiKey}`,
            accept: 'application/json',
            ...(body !== undefined
              ? { 'content-type': 'application/json' }
              : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) return (await response.json()) as T;

        const detail = await this.errorDetail(response);
        lastError = new PartsBazarApiError(
          `PartsBazar360 responded ${response.status}: ${detail}`,
          response.status,
          RETRYABLE_STATUSES.has(response.status),
        );
        if (!lastError.retryable || attempt === maxAttempts) throw lastError;
        await this.sleep(this.retryDelay(response, attempt, baseDelay));
      } catch (error) {
        if (error instanceof PartsBazarApiError) {
          if (!error.retryable || attempt === maxAttempts) throw error;
          lastError = error;
          continue;
        }
        // Network failure or timeout: no response to inspect, worth retrying.
        lastError = new PartsBazarApiError(
          `PartsBazar360 request failed: ${error instanceof Error ? error.message : String(error)}`,
          null,
          true,
        );
        if (attempt === maxAttempts) throw lastError;
        this.logger.warn(
          `${method} ${path || '/'} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`,
        );
        await this.sleep(baseDelay * 2 ** (attempt - 1));
      }
    }
    throw lastError ?? new PartsBazarApiError('Request failed', null, false);
  }

  private retryDelay(response: Response, attempt: number, baseDelay: number) {
    const retryAfter = Number(response.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter >= 0) {
      return Math.min(retryAfter * 1_000, 30_000);
    }
    return Math.min(baseDelay * 2 ** (attempt - 1), 30_000);
  }

  private async errorDetail(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as { message?: string | string[] };
      const message = Array.isArray(data.message)
        ? data.message.join('; ')
        : data.message;
      return (message ?? response.statusText).slice(0, 500);
    } catch {
      return response.statusText || 'no detail';
    }
  }

  private number(name: string, fallback: number): number {
    const value = Number(this.config.get<string>(name));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private sleep(ms: number) {
    return ms > 0
      ? new Promise<void>((resolve) => setTimeout(resolve, ms))
      : Promise.resolve();
  }
}
