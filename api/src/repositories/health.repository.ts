import { pool } from '@/providers/db';
import { redis } from '@/providers/redis';

export async function pingPostgres() {
  await pool.query('SELECT 1');
}

export async function pingRedis() {
  await redis.ping();
}
