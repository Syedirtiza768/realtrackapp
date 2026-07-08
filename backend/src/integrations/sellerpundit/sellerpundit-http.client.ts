import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosError } from 'axios';

@Injectable()
export class SellerpunditHttpClient {
  constructor(private readonly config: ConfigService) {}

  authBaseUrl(): string {
    const raw = this.config.get<string>(
      'SELLERPUNDIT_API_BASE_URL',
      'https://authentication.sellerpundit.com/api/v1',
    );
    return raw.replace(/\/$/, '');
  }

  marketplacesBaseUrl(): string {
    return (
      this.config.get<string>(
        'SELLERPUNDIT_MARKETPLACES_URL',
        'https://marketplaces.sellerpundit.com',
      ) ?? 'https://marketplaces.sellerpundit.com'
    ).replace(/\/$/, '');
  }

  async login(email: string, password: string): Promise<string> {
    try {
      const { data } = await axios.post(
        `${this.authBaseUrl()}/auth/login`,
        { email, password },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 },
      );
      const token =
        (data as { token?: string }).token ??
        (data as { accessToken?: string }).accessToken ??
        (data as { data?: { token?: string } }).data?.token;
      if (!token || typeof token !== 'string') {
        throw this.toError(
          502,
          'SellerPundit login did not return a JWT token',
        );
      }
      return token;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw this.fromAxios(e);
    }
  }

  async get<T>(
    jwt: string,
    path: string,
    query?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(
      `${this.marketplacesBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    try {
      const { data } = await axios.get<T>(url.toString(), {
        headers: { Authorization: `Bearer ${jwt}` },
        timeout: 60_000,
      });
      return data;
    } catch (e) {
      throw this.fromAxios(e);
    }
  }

  async post<T>(jwt: string, path: string, body: unknown): Promise<T> {
    return this.requestWithGatewayRetry(() =>
      axios.post<T>(
        `${this.marketplacesBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`,
        body,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          timeout: 180_000,
        },
      ),
    );
  }

  private async requestWithGatewayRetry<T>(
    fn: () => Promise<{ data: T }>,
    attempts = 2,
  ): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const { data } = await fn();
        return data;
      } catch (e) {
        lastErr = e;
        if (
          !axios.isAxiosError(e) ||
          e.response?.status !== 504 ||
          i === attempts - 1
        ) {
          throw this.fromAxios(e);
        }
      }
    }
    throw this.fromAxios(lastErr);
  }

  fromAxios(err: unknown): never {
    if (axios.isAxiosError(err)) {
      throw this.fromAxiosError(err);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpException({ message: msg, errors: [msg] }, 502);
  }

  private fromAxiosError(err: AxiosError): never {
    let status = err.response?.status ?? 502;
    // Prevent upstream 401/403 from SellerPundit from being propagated as-is.
    // The frontend treats any 401 as "app session expired" and logs the user out.
    if (status === 401 || status === 403) {
      status = 502;
    }
    const body = err.response?.data;
    const errors: string[] = [];
    let message = err.message;

    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if (typeof b.message === 'string') message = b.message;
      if (typeof b.error === 'string') errors.push(b.error);
      if (Array.isArray(b.errors)) {
        for (const item of b.errors) {
          if (typeof item === 'string') errors.push(item);
          else if (item && typeof item === 'object' && 'message' in item) {
            errors.push(String((item as { message: unknown }).message));
          }
        }
      }
      const data = b.data;
      if (
        data &&
        typeof data === 'object' &&
        Array.isArray((data as { errors?: unknown }).errors)
      ) {
        for (const item of (data as { errors: unknown[] }).errors) {
          if (typeof item === 'string') errors.push(item);
        }
      }
    }

    if (!errors.length) errors.push(message);
    if (status === 504) {
      message =
        'SellerPundit API gateway timed out (504). The listing may still be processing — check eBay, retry in a minute, or use direct eBay publish fallback.';
      errors.unshift(message);
    }
    const details =
      body != null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : undefined;
    throw new HttpException({ message, errors, details }, status);
  }

  toError(httpStatus: number, message: string): HttpException {
    return new HttpException({ message, errors: [message] }, httpStatus);
  }
}
