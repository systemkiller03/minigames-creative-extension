import { createVerifiedUser, login, newClient, redis } from './helpers';
import { fakeUpstream } from './fake-upstream';

export { fakeUpstream };

export async function clearUpstreamCache() {
  const keys = await redis.keys('cache:up:*');
  if (keys.length > 0) await redis.del(...keys);
}

/** Makes every cached upstream entry stale (but still stored), as if its TTL had passed. */
export async function expireUpstreamCache() {
  for (const key of await redis.keys('cache:up:*')) {
    const entry = JSON.parse((await redis.get(key))!) as { freshUntil: number };
    entry.freshUntil = 0;
    await redis.set(key, JSON.stringify(entry), 'EX', 3600);
  }
}

export async function signedInUser() {
  const creds = await createVerifiedUser();
  const client = newClient();
  const body = await login(client, creds);
  return {
    ...creds,
    userId: body.user.id,
    client,
    auth: { Authorization: `Bearer ${body.accessToken}` },
  };
}
