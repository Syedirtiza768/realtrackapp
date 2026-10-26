import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class PartsSearchUpstreamError extends Error {
  constructor(
    message: string,
    /** HTTP status from PartsBazar360, or null for timeouts/network errors. */
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'PartsSearchUpstreamError';
  }
}

const DEFAULT_API_URL = 'https://partsbazar360.com/api';
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export interface PartsSearchRequestOptions {
  /** Send PARTSBAZAR360_SEARCH_API_KEY as a bearer token. */
  internal?: boolean;
  /** Total attempts; retries only on 502/503/504 and network errors. */
  attempts?: number;
}

/**
 * Read-only HTTP client for PartsBazar360 search.
 *
 * Separate from the publishing client (`channels/partsbazar360`): different
 * key, no write paths, short timeouts because a person is waiting on every
 * call. The key is read from env per call and never logged.
 */
@Injectable()
export class PartsSearchClient {
  constructor(private readonly config: ConfigService) {}

  get baseUrl(): string {
    return this.config
      .get<string>('PARTSBAZAR360_API_URL', DEFAULT_API_URL)
      .trim()
      .replace(/\/+$/, '');
  }

  get internalKey(): string | null {
    return this.config.get<string>('PARTSBAZAR360_SEARCH_API_KEY')?.trim() || null;
  }

  private get timeoutMs(): number {
    const value = Number(this.config.get<string>('PARTS_SEARCH_TIMEOUT_MS', '8000'));
    return Number.isFinite(value) && value > 0 ? value : 8000;
  }

  async get<T>(
    path: string,
    params: Array<[string, string]> = [],
    options: PartsSearchRequestOptions = {},
  ): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.internal) {
      const key = this.internalKey;
      if (!key) {
        throw new PartsSearchUpstreamError(
          'PARTSBAZAR360_SEARCH_API_KEY is not configured',
          null,
        );
      }
      headers.Authorization = `Bearer ${key}`;
    }

    const attempts = Math.max(1, options.attempts ?? 1);
    let lastError: PartsSearchUpstreamError | null = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.ok) return (await response.json()) as T;
        lastError = new PartsSearchUpstreamError(
          await this.errorMessage(response),
          response.status,
        );
        if (!RETRYABLE_STATUSES.has(response.status)) throw lastError;
      } catch (error) {
        if (error instanceof PartsSearchUpstreamError && error.status !== null && !RETRYABLE_STATUSES.has(error.status)) {
          throw error;
        }
        lastError =
          error instanceof PartsSearchUpstreamError
            ? error
            : new PartsSearchUpstreamError(
                (error as Error)?.name === 'TimeoutError'
                  ? `PartsBazar360 did not answer within ${this.timeoutMs} ms`
                  : `PartsBazar360 is unreachable: ${(error as Error)?.message ?? error}`,
                null,
              );
      }
    }
    throw lastError ?? new PartsSearchUpstreamError('PartsBazar360 request failed', null);
  }

  private async errorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: unknown };
      const message = Array.isArray(body?.message)
        ? body.message.join('; ')
        : typeof body?.message === 'string'
          ? body.message
          : null;
      if (message) return message.slice(0, 300);
    } catch {
      /* not JSON */
    }
    return `PartsBazar360 returned HTTP ${response.status}`;
  }
}
