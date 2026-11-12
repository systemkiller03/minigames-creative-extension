import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotFoundException,
  ServiceUnavailableException,
  UpstreamException,
  ValidationException,
} from '@/errors/http-exceptions';

// setup.ts mocks the module for the other tests; this file tests the real client.
const { UpstreamClient } = await vi.importActual<typeof import('@/services/upstream.client')>(
  '@/services/upstream.client',
);

type Reply = { status: number; body?: unknown; delayMs?: number };
let server: Server;
let client: InstanceType<typeof UpstreamClient>;
let replies: Reply[] = [];
let seen: { method?: string; url?: string; body: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, body });
      const reply = replies.shift() ?? { status: 200, body: { data: 'ok' } };
      setTimeout(() => {
        res.writeHead(reply.status, { 'Content-Type': 'application/json' });
        res.end(reply.body === undefined ? '' : JSON.stringify(reply.body));
      }, reply.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  client = new UpstreamClient(`http://127.0.0.1:${port}/`, 300);
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  replies = [];
  seen = [];
});

describe('UpstreamClient', () => {
  it('sends query parameters, skips undefined ones and returns the body', async () => {
    const result = await client.get('/api/games', { page: 2, category: 'puzzle', sort: undefined });
    expect(result).toEqual({ data: 'ok' });
    expect(seen[0]?.url).toBe('/api/games?page=2&category=puzzle');
  });

  it('posts a JSON body', async () => {
    await client.post('/api/games/x/favorite', { userEmail: 'u@x.invalid' });
    expect(seen[0]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(seen[0]!.body)).toEqual({ userEmail: 'u@x.invalid' });
  });

  it('maps 404 and "not found" 400 to NotFound', async () => {
    replies = [{ status: 404, body: { error: 'Game not found: x' } }];
    await expect(client.get('/api/games/x')).rejects.toBeInstanceOf(NotFoundException);
    replies = [{ status: 400, body: { error: 'Game not found: x' } }];
    await expect(client.get('/api/games/x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps another 400 to a validation error', async () => {
    replies = [{ status: 400, body: { error: 'bad sort' } }];
    await expect(client.get('/api/games')).rejects.toBeInstanceOf(ValidationException);
  });

  it('maps 429 to 503 with the upstream wait time and does not retry', async () => {
    replies = [{ status: 429, body: { error: 'Rate limit exceeded. Try again in 42 seconds' } }];
    const error = await client.get('/api/games').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).headers).toEqual({ 'Retry-After': '42' });
    expect(seen).toHaveLength(1);
  });

  it('retries a GET once after a 5xx', async () => {
    replies = [{ status: 500 }, { status: 200, body: { data: 'second try' } }];
    await expect(client.get('/api/games')).resolves.toEqual({ data: 'second try' });
    expect(seen).toHaveLength(2);
  });

  it('gives up after one retry with a 502', async () => {
    replies = [{ status: 503 }, { status: 503 }];
    await expect(client.get('/api/games')).rejects.toBeInstanceOf(UpstreamException);
    expect(seen).toHaveLength(2);
  });

  it('never retries a POST', async () => {
    replies = [{ status: 500 }];
    await expect(client.post('/api/games/x/favorite', {})).rejects.toBeInstanceOf(
      UpstreamException,
    );
    expect(seen).toHaveLength(1);
  });

  it('turns a timeout into a 502', async () => {
    replies = [
      { status: 200, delayMs: 800 },
      { status: 200, delayMs: 800 },
    ];
    await expect(client.get('/api/games')).rejects.toBeInstanceOf(UpstreamException);
  });

  it('rejects an empty success body', async () => {
    replies = [{ status: 200 }, { status: 200 }];
    await expect(client.get('/api/games')).rejects.toBeInstanceOf(UpstreamException);
  });
});
