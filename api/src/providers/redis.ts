import { Redis } from 'ioredis';
import { env } from '@/config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('Redis error', err);
});

export async function closeRedis() {
  await redis.quit();
}
