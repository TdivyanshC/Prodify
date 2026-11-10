import { API_URL } from './config';
import { withRetry } from './retry';

// Thin fetch wrapper for the Phase 2 API: bearer token, JSON, one error
// type built from the server's `{ error: { code, message, details } }`
// envelope (backend doc §5.1), so every caller handles errors one way.

let token: string | null = null;

export function setAuthToken(next: string | null) {
  token = next;
}
export const getAuthToken = () => token;

// Fired when a request made with a token comes back 401 - the saved session
// expired or was revoked (e.g. signed out on another device). The auth store
// registers it and returns the app to the sign-in screen, so a dead token can
// never leave the app showing stale data while every call silently fails.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

// Render's free tier sleeps after ~15 min idle; the first request then takes
// 30-60s while it wakes (the proxy answers 502/503 meanwhile). So idempotent
// calls retry network errors and gateway errors with backoff, ~60s in all,
// instead of failing on the first try.
const TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [1500, 3000, 6000, 10_000];
const GATEWAY = new Set([502, 503, 504]);

interface RequestOptions {
  // Safe to repeat: GETs by default; POSTs opt in (the auth upsert is idempotent).
  retry?: boolean;
}

async function attempt<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(0, 'NETWORK', `Can't reach the Prodify server at ${API_URL}`, err);
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    // Sign-in calls handle their own 401s (wrong/expired credentials); only a
    // token that was previously accepted going bad means the session is over.
    if (res.status === 401 && token && !path.startsWith('/auth/')) onUnauthorized?.();
    throw new ApiError(res.status, e?.code ?? 'HTTP_' + res.status, e?.message ?? 'Something went wrong', e?.details);
  }
  return json as T;
}

async function request<T>(method: string, path: string, body?: unknown, { retry = method === 'GET' }: RequestOptions = {}): Promise<T> {
  const once = () => attempt<T>(method, path, body);
  if (!retry) return once();
  const transient = (err: unknown) => err instanceof ApiError && (err.status === 0 || GATEWAY.has(err.status));
  return withRetry(once, transient, RETRY_DELAYS_MS);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, body ?? {}, opts),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};
