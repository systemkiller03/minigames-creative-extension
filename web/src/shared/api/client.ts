const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/u, '') || '/api';

type ErrorDetail = { in?: string; path?: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  readonly retryAfter: number | null;

  constructor(
    status: number,
    code = 'INTERNAL',
    message = `API request failed with status ${status}`,
    details: ErrorDetail[] = [],
    retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

let accessToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal | undefined;
  /** Skip the bearer header and the refresh-and-retry behaviour. */
  anonymous?: boolean;
};

async function toApiError(response: Response): Promise<ApiError> {
  const retryHeader = Number(response.headers.get('Retry-After'));
  const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null;

  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: ErrorDetail[] };
    };
    return new ApiError(
      response.status,
      payload.error?.code,
      payload.error?.message,
      payload.error?.details,
      retryAfter,
    );
  } catch {
    return new ApiError(response.status, undefined, undefined, undefined, retryAfter);
  }
}

async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token && !options.anonymous) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${normalizedPath}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

/** Exchange the refresh cookie for a new access token; concurrent calls share one request. */
export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST', anonymous: true }, null);
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      const payload = (await response.json()) as { accessToken: string };
      accessToken = payload.accessToken;
      return accessToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options, accessToken);

  if (response.status === 401 && !options.anonymous) {
    const hadSession = accessToken !== null;
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(path, options, refreshed);
    } else if (hadSession) {
      sessionExpiredHandler?.();
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getApiData<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, { signal });
}
