import { redis } from '@/providers/redis';

const REFRESH_KEY_PREFIX = 'auth:refresh:';
const ACCESS_KEY_PREFIX = 'auth:access:';

export type AuthContext = {
  sessionId: string;
  userId: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  idleExpiresAt: number;
  maxExpiresAt: number;
  userAgent: string;
  ipAddress: string;
  currentRefreshHash: string;
  currentAccessHash: string;
  csrfHash: string;
};

const CREATE_SESSION = `
  redis.call('HSET', KEYS[1],
    'id', ARGV[1], 'userId', ARGV[2], 'createdAt', ARGV[3],
    'lastSeenAt', ARGV[3], 'idleExpiresAt', ARGV[4], 'maxExpiresAt', ARGV[5],
    'userAgent', ARGV[6], 'ipAddress', ARGV[7],
    'currentRefreshHash', ARGV[8], 'currentAccessHash', ARGV[9], 'csrfHash', ARGV[10])
  redis.call('EXPIRE', KEYS[1], ARGV[11])
  redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[11])
  redis.call('SET', KEYS[3], ARGV[1], 'EX', ARGV[12])
  redis.call('SADD', KEYS[4], ARGV[8])
  redis.call('EXPIRE', KEYS[4], ARGV[11])
  redis.call('HSET', KEYS[5], ARGV[8], ARGV[10])
  redis.call('EXPIRE', KEYS[5], ARGV[11])
  redis.call('ZADD', KEYS[6], ARGV[3], ARGV[1])
  return 1
`;

const REVOKE_SESSION = `
  local userId = redis.call('HGET', KEYS[1], 'userId')
  if not userId then
    redis.call('ZREM', KEYS[2], ARGV[2])
    return 0
  end
  if userId ~= ARGV[1] then
    return 0
  end
  local accessHash = redis.call('HGET', KEYS[1], 'currentAccessHash')
  if accessHash then redis.call('DEL', '${ACCESS_KEY_PREFIX}' .. accessHash) end
  local refreshHashes = redis.call('SMEMBERS', KEYS[3])
  for _, hash in ipairs(refreshHashes) do
    redis.call('DEL', '${REFRESH_KEY_PREFIX}' .. hash)
  end
  redis.call('DEL', KEYS[1], KEYS[3], KEYS[4])
  redis.call('ZREM', KEYS[2], ARGV[2])
  return 1
`;

const ROTATE_TOKENS = `
  local sid = redis.call('GET', KEYS[2])
  if not sid or sid ~= ARGV[1] then return 0 end
  if redis.call('EXISTS', KEYS[1]) == 0 then
    redis.call('DEL', KEYS[2])
    return 0
  end
  local function revoke()
    local accessHash = redis.call('HGET', KEYS[1], 'currentAccessHash')
    if accessHash then redis.call('DEL', '${ACCESS_KEY_PREFIX}' .. accessHash) end
    local hashes = redis.call('SMEMBERS', KEYS[7])
    for _, hash in ipairs(hashes) do
      redis.call('DEL', '${REFRESH_KEY_PREFIX}' .. hash)
    end
    redis.call('DEL', KEYS[1], KEYS[7], KEYS[8])
    redis.call('ZREM', KEYS[6], ARGV[1])
  end
  if redis.call('HGET', KEYS[1], 'currentRefreshHash') ~= ARGV[2] then
    revoke()
    return -1
  end
  local now = tonumber(ARGV[6])
  local idleExpiry = tonumber(redis.call('HGET', KEYS[1], 'idleExpiresAt') or '0')
  local maxExpiry = tonumber(redis.call('HGET', KEYS[1], 'maxExpiresAt') or '0')
  if now >= idleExpiry or now >= maxExpiry then
    revoke()
    return 0
  end
  local ttl = math.ceil((maxExpiry - now) / 1000)
  redis.call('HSET', KEYS[1],
    'currentRefreshHash', ARGV[3], 'currentAccessHash', ARGV[4],
    'csrfHash', ARGV[5], 'lastSeenAt', ARGV[6], 'idleExpiresAt', ARGV[7],
    'userAgent', ARGV[9], 'ipAddress', ARGV[10])
  redis.call('EXPIRE', KEYS[1], ttl)
  redis.call('EXPIRE', KEYS[7], ttl)
  redis.call('HSET', KEYS[8], ARGV[3], ARGV[5])
  redis.call('EXPIRE', KEYS[8], ttl)
  redis.call('SET', KEYS[2], ARGV[1], 'EX', ttl)
  redis.call('SET', KEYS[3], ARGV[1], 'EX', ttl)
  redis.call('SADD', KEYS[7], ARGV[3])
  redis.call('DEL', KEYS[4])
  redis.call('SET', KEYS[5], ARGV[1], 'EX', ARGV[8])
  redis.call('ZADD', KEYS[6], ARGV[6], ARGV[1])
  return 1
`;

const UPDATE_CSRF = `
  if redis.call('GET', KEYS[2]) ~= ARGV[1]
    or redis.call('HGET', KEYS[1], 'currentRefreshHash') ~= ARGV[2] then
    return 0
  end
  redis.call('HSET', KEYS[1], 'csrfHash', ARGV[3])
  redis.call('HSET', KEYS[3], ARGV[2], ARGV[3])
  return 1
`;

function sessionFromHash(id: string, values: Record<string, string>): AuthSession | null {
  if (!values.userId || !values.currentRefreshHash || !values.currentAccessHash) return null;
  return {
    id,
    userId: values.userId,
    createdAt: Number(values.createdAt),
    lastSeenAt: Number(values.lastSeenAt),
    idleExpiresAt: Number(values.idleExpiresAt),
    maxExpiresAt: Number(values.maxExpiresAt),
    userAgent: values.userAgent ?? '',
    ipAddress: values.ipAddress ?? '',
    currentRefreshHash: values.currentRefreshHash,
    currentAccessHash: values.currentAccessHash,
    csrfHash: values.csrfHash ?? '',
  };
}

export class SessionsRepository {
  private sessionKey(id: string) {
    return `auth:session:${id}`;
  }

  private userSessionsKey(userId: string) {
    return `auth:user-sessions:${userId}`;
  }

  private refreshHashesKey(id: string) {
    return `auth:session-refreshes:${id}`;
  }

  private csrfHashesKey(id: string) {
    return `auth:session-csrf:${id}`;
  }

  async create(input: {
    id: string;
    userId: string;
    now: number;
    idleExpiresAt: number;
    maxExpiresAt: number;
    userAgent: string;
    ipAddress: string;
    refreshHash: string;
    accessHash: string;
    csrfHash: string;
    accessTtlSeconds: number;
  }) {
    const ttl = Math.ceil((input.maxExpiresAt - input.now) / 1000);
    await redis.eval(
      CREATE_SESSION,
      6,
      this.sessionKey(input.id),
      `${REFRESH_KEY_PREFIX}${input.refreshHash}`,
      `${ACCESS_KEY_PREFIX}${input.accessHash}`,
      this.refreshHashesKey(input.id),
      this.csrfHashesKey(input.id),
      this.userSessionsKey(input.userId),
      input.id,
      input.userId,
      String(input.now),
      String(input.idleExpiresAt),
      String(input.maxExpiresAt),
      input.userAgent,
      input.ipAddress,
      input.refreshHash,
      input.accessHash,
      input.csrfHash,
      String(ttl),
      String(input.accessTtlSeconds),
    );
  }

  async findByAccessHash(accessHash: string) {
    const id = await redis.get(`${ACCESS_KEY_PREFIX}${accessHash}`);
    if (!id) return null;

    const session = sessionFromHash(id, await redis.hgetall(this.sessionKey(id)));
    if (
      !session ||
      session.currentAccessHash !== accessHash ||
      session.idleExpiresAt <= Date.now() ||
      session.maxExpiresAt <= Date.now()
    ) {
      if (session) await this.revoke(session.id, session.userId);
      else await redis.del(`${ACCESS_KEY_PREFIX}${accessHash}`);
      return null;
    }
    return session;
  }

  async findByRefreshHash(refreshHash: string) {
    const id = await redis.get(`${REFRESH_KEY_PREFIX}${refreshHash}`);
    if (!id) return null;

    const session = sessionFromHash(id, await redis.hgetall(this.sessionKey(id)));
    if (!session) {
      await redis.del(`${REFRESH_KEY_PREFIX}${refreshHash}`);
      return null;
    }
    if (session.idleExpiresAt <= Date.now() || session.maxExpiresAt <= Date.now()) {
      await this.revoke(session.id, session.userId);
      return null;
    }
    return session;
  }

  async rotate(input: {
    session: AuthSession;
    presentedRefreshHash: string;
    now: number;
    idleExpiresAt: number;
    refreshHash: string;
    accessHash: string;
    csrfHash: string;
    accessTtlSeconds: number;
    userAgent: string;
    ipAddress: string;
  }) {
    const oldRefreshHash = input.presentedRefreshHash;
    return Number(
      await redis.eval(
        ROTATE_TOKENS,
        8,
        this.sessionKey(input.session.id),
        `${REFRESH_KEY_PREFIX}${oldRefreshHash}`,
        `${REFRESH_KEY_PREFIX}${input.refreshHash}`,
        `${ACCESS_KEY_PREFIX}${input.session.currentAccessHash}`,
        `${ACCESS_KEY_PREFIX}${input.accessHash}`,
        this.userSessionsKey(input.session.userId),
        this.refreshHashesKey(input.session.id),
        this.csrfHashesKey(input.session.id),
        input.session.id,
        oldRefreshHash,
        input.refreshHash,
        input.accessHash,
        input.csrfHash,
        String(input.now),
        String(input.idleExpiresAt),
        String(input.accessTtlSeconds),
        input.userAgent,
        input.ipAddress,
      ),
    );
  }

  async findCsrfHash(sessionId: string, refreshHash: string) {
    return redis.hget(this.csrfHashesKey(sessionId), refreshHash);
  }

  async updateCsrf(session: AuthSession, csrfHash: string) {
    return Number(
      await redis.eval(
        UPDATE_CSRF,
        3,
        this.sessionKey(session.id),
        `${REFRESH_KEY_PREFIX}${session.currentRefreshHash}`,
        this.csrfHashesKey(session.id),
        session.id,
        session.currentRefreshHash,
        csrfHash,
      ),
    );
  }

  async listForUser(userId: string) {
    const ids = await redis.zrevrange(this.userSessionsKey(userId), '0', '-1');
    const sessions = await Promise.all(
      ids.map(async (id) => {
        const session = sessionFromHash(id, await redis.hgetall(this.sessionKey(id)));
        if (!session) {
          await redis.zrem(this.userSessionsKey(userId), id);
          return null;
        }
        if (session.idleExpiresAt <= Date.now() || session.maxExpiresAt <= Date.now()) {
          await this.revoke(id, userId);
          return null;
        }
        return session;
      }),
    );
    return sessions.filter((session): session is AuthSession => session !== null);
  }

  async revoke(id: string, userId: string) {
    return Number(
      await redis.eval(
        REVOKE_SESSION,
        4,
        this.sessionKey(id),
        this.userSessionsKey(userId),
        this.refreshHashesKey(id),
        this.csrfHashesKey(id),
        userId,
        id,
      ),
    );
  }

  async revokeAllForUser(userId: string) {
    const ids = await redis.zrange(this.userSessionsKey(userId), '0', '-1');
    const revoked = await Promise.all(ids.map((id) => this.revoke(id, userId)));
    return revoked.reduce((total, result) => total + result, 0);
  }
}

export const sessionsRepository = new SessionsRepository();
