import { pingPostgres, pingRedis } from '@/repositories/health.repository';
import { withTimeout } from '@/utils/with-timeout';

const CHECK_TIMEOUT_MS = 2000;

export async function getHealth() {
  const [pg, rd] = await Promise.allSettled([
    withTimeout(pingPostgres(), CHECK_TIMEOUT_MS, 'postgres'),
    withTimeout(pingRedis(), CHECK_TIMEOUT_MS, 'redis'),
  ]);

  if (pg.status === 'rejected') console.error('Health: postgres failed', pg.reason);
  if (rd.status === 'rejected') console.error('Health: redis failed', rd.reason);

  const checks = {
    postgres: pg.status === 'fulfilled' ? 'up' : 'down',
    redis: rd.status === 'fulfilled' ? 'up' : 'down',
  } as const;

  return { healthy: pg.status === 'fulfilled' && rd.status === 'fulfilled', checks };
}
