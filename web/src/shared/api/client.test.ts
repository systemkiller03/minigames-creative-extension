import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/utils';
import {
  ApiError,
  apiRequest,
  getAccessToken,
  getApiData,
  refreshAccessToken,
  setAccessToken,
  setSessionExpiredHandler,
} from './client';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken(null);
  setSessionExpiredHandler(null);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('sends GET with credentials and no body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    await expect(getApiData('catalog/x')).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/catalog/x');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });

  it('sends JSON body and bearer token', async () => {
    setAccessToken('tok');
    expect(getAccessToken()).toBe('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await apiRequest('/a', { method: 'POST', body: { x: 1 } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe('{"x":1}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
  });

  it('skips bearer for anonymous requests', async () => {
    setAccessToken('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await apiRequest('/a', { anonymous: true });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiRequest('/a')).resolves.toBeUndefined();
  });

  it('throws ApiError with payload details', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'BAD', message: 'Nope', details: [{ message: 'd' }] } }, 400),
    );
    const error = await apiRequest('/a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'BAD', message: 'Nope' });
  });

  it('falls back when the error body is not JSON and reads Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('oops', { status: 429, headers: { 'Retry-After': '12' } }),
    );
    const error = (await apiRequest('/a').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(429);
    expect(error.code).toBe('INTERNAL');
    expect(error.retryAfter).toBe(12);
  });

  it('refreshes the token on 401 and retries', async () => {
    setAccessToken('old');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new' }))
      .mockResolvedValueOnce(jsonResponse({ done: true }));
    await expect(apiRequest('/a')).resolves.toEqual({ done: true });
    expect(getAccessToken()).toBe('new');
    const retryInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(retryInit.headers).toMatchObject({ Authorization: 'Bearer new' });
  });

  it('calls the session-expired handler when refresh fails for a signed-in user', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    setAccessToken('old');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(apiRequest('/a')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('does not call the handler for guests', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    await expect(apiRequest('/a')).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('refreshAccessToken', () => {
  it('shares one request between concurrent callers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accessToken: 't' }));
    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(a).toBe('t');
    expect(b).toBe('t');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(refreshAccessToken()).resolves.toBeNull();
  });
});
