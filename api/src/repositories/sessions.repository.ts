import { redis } from '@/providers/redis';

/**
 * A "family" is one login on one device. Its id (`sid`) never changes; only the
 * refresh token `jti` inside it rotates. See docs/auth-design.md.
 */
const FAMILY_PREFIX = 'auth:family:';
const USER_FAMILIES_PREFIX = 'auth:user-families:';

export type Family = {
  id: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  maxExpiresAt: number;
  userAgent: string;
  ipAddress: string;
};

export const RotateResult = {
  Rotated: 1,
  /** Family does not exist, is expired, or belongs to someone else. */
  Invalid: 0,
  /** A stale jti outside the grace window was presented; the family was deleted. */
  Reuse: -1,
} as const;

const CREATE_FAMILY = `
  redis.call('HSET', KEYS[1],
    'userId', ARGV[1], 'currentJti', ARGV[2], 'previousJti', '', 'rotatedAt', ARGV[3],
    'createdAt', ARGV[3], 'lastSeenAt', ARGV[3], 'maxExpiresAt', ARGV[4],
    'userAgent', ARGV[5], 'ipAddress', ARGV[6])
  redis.call('PEXPIRE', KEYS[1], ARGV[7])
  redis.call('ZADD', KEYS[2], ARGV[3], ARGV[8])
  return 1
`;

// KEYS: family, user index
// ARGV: sid, userId, presentedJti, newJti, now, graceMs, idleMs, userAgent, ipAddress
const ROTATE = `
  local f = redis.call('HMGET', KEYS[1], 'userId', 'currentJti', 'previousJti', 'rotatedAt', 'maxExpiresAt')
  if not f[1] or f[1] ~= ARGV[2] then return {0, ''} end
  local now = tonumber(ARGV[5])
  local maxExpiresAt = tonumber(f[5])
  if now >= maxExpiresAt then
    redis.call('DEL', KEYS[1])
    redis.call('ZREM', KEYS[2], ARGV[1])
    return {0, ''}
  end
  local isCurrent = f[2] == ARGV[3]
  local inGrace = f[3] == ARGV[3] and f[3] ~= '' and (now - tonumber(f[4])) <= tonumber(ARGV[6])
  if not isCurrent and not inGrace then
    redis.call('DEL', KEYS[1])
    redis.call('ZREM', KEYS[2], ARGV[1])
    return {-1, ''}
  end
  redis.call('HSET', KEYS[1],
    'previousJti', f[2], 'currentJti', ARGV[4], 'rotatedAt', ARGV[5], 'lastSeenAt', ARGV[5],
    'userAgent', ARGV[8], 'ipAddress', ARGV[9])
  local ttl = math.min(tonumber(ARGV[7]), maxExpiresAt - now)
  redis.call('PEXPIRE', KEYS[1], math.ceil(ttl))
  redis.call('ZADD', KEYS[2], ARGV[5], ARGV[1])
  return {1, f[5]}
`;

// KEYS: family, user index. ARGV: userId, sid
const REVOKE = `
  local owner = redis.call('HGET', KEYS[1], 'userId')
  redis.call('ZREM', KEYS[2], ARGV[2])
  if owner == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 1
  end
  return 0
`;

// KEYS: user index. ARGV: userId
const REVOKE_ALL = `
  local ids = redis.call('ZRANGE', KEYS[1], 0, -1)
  local revoked = 0
  for _, sid in ipairs(ids) do
    local key = '${FAMILY_PREFIX}' .. sid
    if redis.call('HGET', key, 'userId') == ARGV[1] then
      redis.call('DEL', key)
      revoked = revoked + 1
    end
  end
  redis.call('DEL', KEYS[1])
  return revoked
`;

function familyFromHash(id: string, values: Record<string, string>): Family | null {
  if (!values.userId) return null;
  return {
    id,
    userId: values.userId,
    createdAt: Number(values.createdAt),
    lastSeenAt: Number(values.lastSeenAt),
    maxExpiresAt: Number(values.maxExpiresAt),
    userAgent: values.userAgent ?? '',
    ipAddress: values.ipAddress ?? '',
  };
}

export class SessionsRepository {
  private familyKey(id: string) {
    return `${FAMILY_PREFIX}${id}`;
  }

  private userFamiliesKey(userId: string) {
    return `${USER_FAMILIES_PREFIX}${userId}`;
  }

  async create(input: {
    id: string;
    userId: string;
    jti: string;
    now: number;
    maxExpiresAt: number;
    idleMs: number;
    userAgent: string;
    ipAddress: string;
  }) {
    const ttlMs = Math.min(input.idleMs, input.maxExpiresAt - input.now);
    await redis.eval(
      CREATE_FAMILY,
      2,
      this.familyKey(input.id),
      this.userFamiliesKey(input.userId),
      input.userId,
      input.jti,
      String(input.now),
      String(input.maxExpiresAt),
      input.userAgent,
      input.ipAddress,
      String(ttlMs),
      input.id,
    );
  }

  /**
   * Atomically checks the presented jti against the whitelist and rotates it.
   * On `Rotated`, `expiresAt` is the new refresh token expiry (ms since epoch).
   */
  async rotate(input: {
    id: string;
    userId: string;
    presentedJti: string;
    newJti: string;
    now: number;
    graceMs: number;
    idleMs: number;
    userAgent: string;
    ipAddress: string;
  }): Promise<{ result: number; expiresAt: number }> {
    const [result, maxExpiresAt] = (await redis.eval(
      ROTATE,
      2,
      this.familyKey(input.id),
      this.userFamiliesKey(input.userId),
      input.id,
      input.userId,
      input.presentedJti,
      input.newJti,
      String(input.now),
      String(input.graceMs),
      String(input.idleMs),
      input.userAgent,
      input.ipAddress,
    )) as [number, string];

    return {
      result: Number(result),
      expiresAt:
        Number(result) === RotateResult.Rotated
          ? Math.min(input.now + input.idleMs, Number(maxExpiresAt))
          : 0,
    };
  }

  async listForUser(userId: string): Promise<Family[]> {
    const indexKey = this.userFamiliesKey(userId);
    const ids = await redis.zrevrange(indexKey, 0, -1);
    if (ids.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const id of ids) pipeline.hgetall(this.familyKey(id));
    const results = (await pipeline.exec()) ?? [];

    const families: Family[] = [];
    const stale: string[] = [];
    const now = Date.now();
    ids.forEach((id, index) => {
      const values = (results[index]?.[1] ?? {}) as Record<string, string>;
      const family = familyFromHash(id, values);
      if (!family || family.userId !== userId || family.maxExpiresAt <= now) stale.push(id);
      else families.push(family);
    });
    if (stale.length > 0) await redis.zrem(indexKey, ...stale);
    return families;
  }

  async revoke(id: string, userId: string) {
    return Number(
      await redis.eval(REVOKE, 2, this.familyKey(id), this.userFamiliesKey(userId), userId, id),
    );
  }

  async revokeAllForUser(userId: string) {
    return Number(await redis.eval(REVOKE_ALL, 1, this.userFamiliesKey(userId), userId));
  }
}

export const sessionsRepository = new SessionsRepository();
