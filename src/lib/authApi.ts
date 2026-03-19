/**
 * fetchWithAuth — Authenticated fetch wrapper.
 *
 * Injects the JWT Bearer token from localStorage into every request.
 * Redirects to /login on 401 responses (expired/invalid token).
 *
 * Usage:
 *   import { fetchWithAuth, authHeaders } from '@/lib/authApi';
 *   const data = await fetchWithAuth<MyType>('/api/listings');
 *   const res  = await fetchWithAuth('/api/settings', { method: 'PUT', body: ... });
 */

const TOKEN_KEY = 'mk_auth_token';

/**
 * Get auth headers for manual use (e.g. with third-party HTTP clients).
 */
export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Authenticated fetch wrapper.
 * Automatically injects Authorization header and handles JSON parsing.
 *
 * @param input  — URL or Request
 * @param init   — Standard RequestInit, merged with auth headers
 * @returns Parsed JSON response (or throws on non-2xx)
 */
export async function fetchWithAuth<T = unknown>(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, { ...init, headers });

  // Handle 401 — token expired or invalid
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('mk_auth_user');
    // Redirect to login (unless already on login page)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    let message = `API ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

/**
 * Convenience: GET with auth
 */
export async function authGet<T = unknown>(path: string): Promise<T> {
  return fetchWithAuth<T>(path);
}

/**
 * Convenience: POST with auth
 */
export async function authPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return fetchWithAuth<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience: PUT with auth
 */
export async function authPut<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return fetchWithAuth<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience: DELETE with auth
 */
export async function authDelete<T = unknown>(path: string): Promise<T> {
  return fetchWithAuth<T>(path, { method: 'DELETE' });
}
