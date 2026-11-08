import { env } from '@/config/env';
import { createApp } from '@/app';
import { closeDb } from './providers/db';
import { closeRedis } from './providers/redis';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await Promise.allSettled([closeDb(), closeRedis()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
