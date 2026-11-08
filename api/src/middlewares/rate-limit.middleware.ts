import type { RequestHandler } from 'express';
import { TooManyRequestsException } from '@/errors/http-exceptions';
import { redis } from '@/providers/redis';

const INCREMENT_RATE_LIMIT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return { count, redis.call('TTL', KEYS[1]) }
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
