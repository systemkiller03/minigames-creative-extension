import { createHash } from 'node:crypto';
import { ServiceUnavailableException, UpstreamException } from '@/errors/http-exceptions';
import { redis } from '@/providers/redis';

/** Entries stay in Redis this long after they stop being fresh, to serve if the upstream is down. */
const STALE_WINDOW_SECONDS = 24 * 60 * 60;

type Entry<T> = { freshUntil: number; value: T };

export function cacheKey(name: string, params: object = {}) {
  const digest = createHash('sha256')
    .update(JSON.stringify([name, params]))
    .digest('hex');
  return `cache:up:${digest}`;
}

async function readEntry<T>(key: string): Promise<Entry<T> | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch {
    return null; // a cache failure must never break a request
  }
}

/**
 * Returns the cached value while fresh. Otherwise loads it; if the upstream is down or busy
 * and an older copy exists, that copy is served instead. Never store per-user data here.
 */
export async function cached<T>(
  name: string,
  params: object,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const key = cacheKey(name, params);
  const entry = await readEntry<T>(key);
  if (entry && entry.freshUntil > Date.now()) return entry.value;

  try {
    const value = await load();
    const fresh: Entry<T> = { freshUntil: Date.now() + ttlSeconds * 1000, value };
    await redis
      .set(key, JSON.stringify(fresh), 'EX', ttlSeconds + STALE_WINDOW_SECONDS)
      .catch(() => undefined);
    return value;
  } catch (error) {
    const unavailable =
      error instanceof UpstreamException || error instanceof ServiceUnavailableException;
    if (entry && unavailable) return entry.value;
    throw error;
  }
}

export async function invalidate(name: string, params: object = {}) {
  await redis.del(cacheKey(name, params)).catch(() => undefined);
}
