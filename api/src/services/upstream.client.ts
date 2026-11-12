import { env } from '@/config/env';
import {
  NotFoundException,
  ServiceUnavailableException,
  UpstreamException,
  ValidationException,
} from '@/errors/http-exceptions';

export type UpstreamQuery = Record<string, string | number | boolean | undefined>;

/** The MiniGames upstream API. Failures are normalised to our own error types. */
export class UpstreamClient {
  constructor(
    private readonly baseUrl = env.UPSTREAM_BASE_URL,
    private readonly timeoutMs = env.UPSTREAM_TIMEOUT_MS,
  ) {}

  /** GETs are retried once on a network error, timeout or upstream 5xx. */
  async get<T>(path: string, query: UpstreamQuery = {}): Promise<T> {
    try {
      return await this.send<T>('GET', path, query);
    } catch (error) {
      if (!(error instanceof UpstreamException)) throw error;
      return this.send<T>('GET', path, query);
    }
  }

  /** Never retried: a retried toggle would flip the state back. */
  post<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>('POST', path, {}, body);
  }

  private async send<T>(
    method: 'GET' | 'POST',
    path: string,
    query: UpstreamQuery,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(this.baseUrl.replace(/\/+$/, '') + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new UpstreamException('Upstream request failed or timed out');
    }

    const payload: unknown = await response.json().catch(() => undefined);
    if (response.ok) {
      if (payload === undefined) throw new UpstreamException('Upstream returned an invalid body');
      return payload as T;
    }
    throw this.mapError(response.status, payload);
  }

  private mapError(status: number, payload: unknown) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Upstream answered ${status}`;

    // The upstream documents "game not found" as both 400 and 404.
    if (status === 404 || (status === 400 && /not found/i.test(message))) {
      return new NotFoundException('Game not found');
    }
    if (status === 400) return new ValidationException('Invalid request');
    if (status === 429) {
      const seconds = Number(/(\d+)\s*second/i.exec(message)?.[1] ?? 30);
      return new ServiceUnavailableException('Catalog is busy, try again shortly', seconds);
    }
    return new UpstreamException(
      status === 401 ? 'Upstream rejected the request' : 'Upstream service error',
    );
  }
}

export const upstream = new UpstreamClient();
