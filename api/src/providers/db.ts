import { Pool } from 'pg';
import { env } from '@/config/env';

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

export async function closeDb() {
  await pool.end();
}
