export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp?: string;
}

export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

/** Same-origin by default (nginx proxies /api); override via VITE_API_BASE. */
export function apiBase(): string {
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
}

export const REQUEST_TIMEOUT_MS = 10_000;

const AUTH_PATH_PREFIX = '/api/v1/auth';

let unauthorizedHandler: (() => void) | null = null;

/** Registers a global handler invoked on unrecoverable 401s (e.g. clear session). */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/** Maps an ApiError/HTTP status to an i18n key for user-friendly display. */
export function apiErrorI18nKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TIMEOUT') return 'api.timeout';
    if (error.code === 'HTTP_401' || error.code === 'UNAUTHORIZED') return 'api.401';
    if (error.code === 'HTTP_403' || error.code === 'FORBIDDEN') return 'api.403';
    if (error.code === 'HTTP_404' || error.code === 'NOT_FOUND') return 'api.404';
    if (error.code.startsWith('HTTP_5')) return 'api.500';
  }
  return 'api.network';
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { credentials: 'include', ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new ApiError(payload.code ?? `HTTP_${response.status}`, payload.message ?? response.statusText);
  }
  return payload.data;
}

function isRetriable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'TIMEOUT' || error.code.startsWith('HTTP_5');
  }
  return true;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'HTTP_401' || error.code === 'UNAUTHORIZED');
}

let refreshing: Promise<boolean> | null = null;

/** Attempts a session refresh once; concurrent callers share the same probe. */
function tryRefreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetchWithTimeout(`${apiBase()}${AUTH_PATH_PREFIX}/refresh`, { method: 'POST' });
      return response.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** On 401: refresh the session once and retry; otherwise surface the error. */
async function withSessionRecovery<T>(path: string, attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    if (path.startsWith(AUTH_PATH_PREFIX)) {
      unauthorizedHandler?.();
      throw error;
    }
    if (await tryRefreshSession()) {
      try {
        return await attempt();
      } catch (retryError) {
        if (isUnauthorized(retryError)) unauthorizedHandler?.();
        throw retryError;
      }
    }
    unauthorizedHandler?.();
    throw error;
  }
}

/** GET with one automatic retry on transient failures (network/timeout/5xx). */
export async function apiGet<T>(path: string): Promise<T> {
  return withSessionRecovery(path, async () => {
    try {
      const response = await fetchWithTimeout(`${apiBase()}${path}`);
      return await unwrap<T>(response);
    } catch (error) {
      if (!isRetriable(error)) throw error;
      const response = await fetchWithTimeout(`${apiBase()}${path}`);
      return unwrap<T>(response);
    }
  });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return withSessionRecovery(path, async () => {
    const response = await fetchWithTimeout(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return unwrap<T>(response);
  });
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return withSessionRecovery(path, async () => {
    const response = await fetchWithTimeout(`${apiBase()}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return unwrap<T>(response);
  });
}