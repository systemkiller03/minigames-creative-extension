import type { RequestHandler } from 'express';
import { TooManyRequestsException, ValidationException } from '@/errors/http-exceptions';
import { hashToken } from '@/middlewares/auth.middleware';
import { redis } from '@/providers/redis';

const INCREMENT_RATE_LIMIT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return { count, redis.call('TTL', KEYS[1]) }
`;

const INCREMENT_MULTI_RATE_LIMIT = `
  local maximumTtl = 1
  local allowed = 1
  for i, key in ipairs(KEYS) do
    local count = redis.call('INCR', key)
    if count == 1 then redis.call('EXPIRE', key, ARGV[1]) end
    local ttl = redis.call('TTL', key)
    if ttl > maximumTtl then maximumTtl = ttl end
    if count > tonumber(ARGV[2]) then allowed = 0 end
  end
  return { allowed, maximumTtl }
`;

export function rateLimit(action: 'login' | 'refresh', limit: number): RequestHandler {
  return async (req, _res, next) => {
    const key = `auth:rate:${action}:${req.ip}`;
    const [count, ttl] = (await redis.eval(INCREMENT_RATE_LIMIT, 1, key, '60')) as [number, number];

    if (count > limit) {
      next(new TooManyRequestsException(Math.max(ttl, 1)));
      return;
    }
    next();
  };
}

export function emailCodeRateLimit(
  scope: 'password-reset' | 'email-verify',
  action: 'request' | 'attempt',
  limit: number,
  windowSeconds: number,
): RequestHandler {
  return async (req, _res, next) => {
    const email = req.body?.email;
    if (typeof email !== 'string') {
      next(new ValidationException('Email is required'));
      return;
    }

    const keys = [
      `auth:rate:${scope}:${action}:ip:${req.ip ?? 'unknown'}`,
      `auth:rate:${scope}:${action}:email:${hashToken(email)}`,
    ];
    const [allowed, ttl] = (await redis.eval(
      INCREMENT_MULTI_RATE_LIMIT,
      keys.length,
      ...keys,
      String(windowSeconds),
      String(limit),
    )) as [number, number];

    if (!allowed) {
      next(new TooManyRequestsException(Math.max(ttl, 1)));
      return;
    }
    next();
  };
}
